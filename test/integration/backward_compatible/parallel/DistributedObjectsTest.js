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
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const expect = chai.expect;

const RC = require('../../RC');
const TestUtil = require('../../../TestUtil');

describe('DistributedObjectsTest', function () {
    let cluster;
    let client;
    let member;

    const testFactory = new TestUtil.TestFactory();

    const toNamespace = (distributedObjects) => {
        return distributedObjects.map((distObj) => distObj.getServiceName() + distObj.getName());
    };

    const filterInternalMaps = (distributedObjects) => {
        return distributedObjects.filter(distObj => !distObj.getName().startsWith('__'));
    };

    beforeEach(async function () {
        cluster = await testFactory.createClusterForParallelTests();
        member = await RC.startMember(cluster.id);
        client = await testFactory.newHazelcastClientForParallelTests({
            clusterName: cluster.id
        }, member);
    });

    afterEach(async function () {
        await testFactory.shutdownAll();
    });

    it('get distributed objects with no object on cluster', async function () {
        const objects = await client.getDistributedObjects();
        expect(filterInternalMaps(objects)).to.have.lengthOf(0);
    });

    it('get distributed objects', async function () {
        const map = await client.getMap(TestUtil.randomString());
        const set = await client.getSet(TestUtil.randomString());
        const queue = await client.getQueue(TestUtil.randomString());
        let objects = await client.getDistributedObjects();
        expect(filterInternalMaps(objects)).to.have.deep.members([map, set, queue]);
        objects = await client.getDistributedObjects();
        // Make sure that live objects are not deleted
        expect(filterInternalMaps(objects)).to.have.deep.members([map, set, queue]);
    });

    it('get distributed objects creates local instances of received proxies', async function () {
        const map = await client.getMap(TestUtil.randomString());
        const set = await client.getSet(TestUtil.randomString());
        const queue = await client.getQueue(TestUtil.randomString());
        let objects = await client.getDistributedObjects();
        expect(filterInternalMaps(objects)).to.have.deep.members([map, set, queue]);
        const otherClient = await testFactory.newHazelcastClientForParallelTests({
            clusterName: cluster.id
        }, member);
        objects = await otherClient.getDistributedObjects();
        // Proxies have different clients, therefore deep equality check fails.
        // Namespace check should be enough
        expect(toNamespace(filterInternalMaps(objects))).to.have.deep.members(toNamespace([map, set, queue]));
        objects = await otherClient.getDistributedObjects();
        // Make sure that live objects are not deleted
        expect(toNamespace(filterInternalMaps(objects))).to.have.deep.members(toNamespace([map, set, queue]));
        await otherClient.shutdown();
    });

    it('get distributed objects should clear local instances of destroyed proxies', async function () {
        const otherClient = await testFactory.newHazelcastClientForParallelTests({
            clusterName: cluster.id
        }, member);
        const map = await client.getMap(TestUtil.randomString());
        const set = await otherClient.getSet(TestUtil.randomString());
        const queue = await client.getQueue(TestUtil.randomString());
        let objects = await client.getDistributedObjects();
        expect(toNamespace(filterInternalMaps(objects))).to.have.deep.members(toNamespace([map, set, queue]));
        await map.destroy();
        objects = await client.getDistributedObjects();
        expect(toNamespace(filterInternalMaps(objects))).to.have.deep.members(toNamespace([set, queue]));
        await set.destroy();
        objects = await client.getDistributedObjects();
        expect(toNamespace(filterInternalMaps(objects))).to.have.deep.members(toNamespace([queue]));
        await queue.destroy();
        objects = await client.getDistributedObjects();
        expect(filterInternalMaps(objects)).to.have.lengthOf(0);
        objects = await otherClient.getDistributedObjects();
        expect(filterInternalMaps(objects)).to.have.lengthOf(0);
        await otherClient.shutdown();
    });
});
