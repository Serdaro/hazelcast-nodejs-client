/*
 * Copyright (c) 2008-2021, Hazelcast, Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

const chai = require('chai');
chai.should();
const long = require('long');

const RC = require('../../../RC');
const TestUtil = require('../../../../TestUtil');
const fs = require('fs');
const path = require('path');

const getHazelcastSqlException = () => {
    const { HazelcastSqlException } = require('../../../../../lib/core/HazelcastError');
    return HazelcastSqlException;
};

const getSqlErrorCode = () => {
    const { SqlErrorCode } = require('../../../../../lib/sql/SqlErrorCode');
    return SqlErrorCode;
};

const getSqlRowMetadataImpl = () => {
    const { SqlRowMetadataImpl } = require('../../../../../lib/sql/SqlRowMetadata');
    return SqlRowMetadataImpl;
};

describe('SqlResultTest', function () {
    let client;
    let cluster;
    let someMap;
    let mapName;
    let result;
    let serverVersionNewerThanFive;

    const testFactory = new TestUtil.TestFactory();
    const JET_ENABLED_CONFIG = fs.readFileSync(path.join(__dirname, 'jet_enabled.xml'), 'utf8');

    before(async function () {
        serverVersionNewerThanFive = await TestUtil.compareServerVersionWithRC(RC, '5.0') >= 0;
        const CLUSTER_CONFIG = serverVersionNewerThanFive ? JET_ENABLED_CONFIG : null;

        TestUtil.markClientVersionAtLeast(this, '4.2');
        cluster = await testFactory.createClusterForParallelTests(null, CLUSTER_CONFIG);
        const member = await RC.startMember(cluster.id);
        client = await testFactory.newHazelcastClientForParallelTests({
            clusterName: cluster.id
        }, member);
        TestUtil.markServerVersionAtLeast(this, client, '4.2');
    });

    beforeEach(async function () {
        mapName = TestUtil.randomString(10);
        someMap = await client.getMap(mapName);
        await TestUtil.createMapping(serverVersionNewerThanFive, client, 'double', 'double', mapName);
        await someMap.put(0, 1);
        await someMap.put(1, 2);
        await someMap.put(2, 3);
        await someMap.put(3, 4);
        await someMap.put(4, 5);
    });

    after(async function () {
        await testFactory.shutdownAll();
    });

    afterEach(async function () {
        await someMap.clear();
    });

    it('should reject iteration after close()', async function () {
        result = await TestUtil.getSql(client).execute(`SELECT * FROM ${mapName} WHERE this > ?`, [1], {cursorBufferSize: 1});
        const error = await TestUtil.getRejectionReasonOrThrow(async () => {
            let counter = 0;
            // eslint-disable-next-line no-empty,no-unused-vars
            for await (const row of result) {
                counter++;
                if (counter === 2) {
                    await result.close();
                }
            }
        });
        error.should.be.instanceof(getHazelcastSqlException());
        error.code.should.be.eq(getSqlErrorCode().CANCELLED_BY_USER);
        error.message.should.include('cancelled');
        error.originatingMemberId.should.be.eq(client.connectionManager.getClientUuid());
    });

    it('getters should work', async function () {
        result = await TestUtil.getSql(client).execute(`SELECT * FROM ${mapName} WHERE this > ?`, [1]);
        const rowMetadata = await TestUtil.getRowMetadata(result);
        rowMetadata.should.be.instanceof(getSqlRowMetadataImpl());
        rowMetadata.getColumnCount().should.be.eq(2);

        const isRowSet = await result.isRowSet();
        isRowSet.should.be.true;

        const updateCount = await TestUtil.getUpdateCount(result);
        updateCount.eq(long.fromNumber(-1)).should.be.true;
    });
});
