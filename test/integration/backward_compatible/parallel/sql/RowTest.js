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

const RC = require('../../../RC');
const TestUtil = require('../../../../TestUtil');
const fs = require('fs');
const path = require('path');

describe('SqlRowTest', function () {
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
        await someMap.put(0, '1');
        await someMap.put(1, '2');
        await someMap.put(2, '3');
        await TestUtil.createMapping(serverVersionNewerThanFive, client, 'double', 'varchar', mapName);

        const sqlService = TestUtil.getSql(client);
        result = await sqlService.execute(`SELECT * FROM ${mapName} WHERE __key > ?`, [0], {
            returnRawResult: true
        });
    });

    after(async function () {
        await testFactory.shutdownAll();
    });

    afterEach(async function () {
        await someMap.clear();
    });

    it('getObject should work', async function () {
        const values = new Set(['2', '3']);
        const keys = new Set([1, 2]);

        for await (const row of result) {
            const rowMetadata = row.getMetadata();
            const value = row.getObject('this');
            value.should.be.eq(row.getObject(rowMetadata.findColumn('this')));
            const key = row.getObject('__key');
            key.should.be.eq(row.getObject(rowMetadata.findColumn('__key')));

            keys.delete(key);
            values.delete(value);

            value.should.be.a('string');
            key.should.be.a('number');
        }

        keys.size.should.be.eq(0);
        values.size.should.be.eq(0);
    });

    it('getMetadata should return same metadata with result', async function () {
        const rowMetadata = await TestUtil.getRowMetadata(result);

        for await (const row of result) {
            row.getMetadata().should.be.eq(rowMetadata);
        }
    });
});
