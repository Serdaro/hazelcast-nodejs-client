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

const { Client } = require('hazelcast-client');

(async () => {
    const client = await Client.newHazelcastClient();
    const set = await client.getSet('my-distributed-set');

    // Add the same item multiple times
    await set.add('key');
    await set.add('key');
    await set.add('key');

    console.log('Item \'key\' is added to the set.');
    const contains = await set.contains('key');
    console.log('Set contains item \'key\':', contains);
    const size = await set.size();
    console.log('Set size:', size);

    await client.shutdown();
})().catch(err => {
    console.error('Error occurred:', err);
    process.exit(1);
});
