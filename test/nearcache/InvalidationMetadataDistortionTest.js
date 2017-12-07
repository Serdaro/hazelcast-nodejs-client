var Controller = require('../RC');
var Client = require('../..').Client;
var Config = require('../..').Config;
var fs = require('fs');
var IdentifiedFactory = require('../javaclasses/IdentifiedFactory');
var DistortInvalidationMetadataEntryProcessor = require('../javaclasses/DistortInvalidationMetadataEntryProcessor');
var Promise = require('bluebird');
var expect = require('chai').expect;

describe.skip('Invalidation metadata distortion', function () {

    var cluster;
    var member;
    var client;
    var validationClient;
    var mapName = 'nc-map';
    var mapSize = 10;

    before(function () {
        return Controller.createCluster(null, fs.readFileSync(__dirname + '/hazelcast_eventual_nearcache.xml', 'utf8')).then(function (cl) {
            cluster = cl;
            return Controller.startMember(cluster.id);
        }).then(function (mem) {
            member = mem;
        });
    });

    after(function () {
        return Controller.shutdownCluster(cluster.id);
    });

    afterEach(function () {
        client.shutdown();
        validationClient.shutdown();
    });

    function createConfig(withNearCache) {
        var cfg = new Config.ClientConfig();
        if (withNearCache) {
            var ncc = new Config.NearCacheConfig();
            ncc.name = mapName;
            cfg.nearCacheConfigs[mapName] = ncc;
        }
        cfg.serializationConfig.defaultNumberType = "integer";
        cfg.serializationConfig.dataSerializableFactories[66] = new IdentifiedFactory();
        return cfg;
    }

    beforeEach(function () {
        return Client.newHazelcastClient(createConfig(true)).then(function (cl) {
            client = cl;
            return Client.newHazelcastClient(createConfig(false));
        }).then(function (cl) {
            validationClient = cl;
        });
    });


    it('lost invalidation', function (done) {
        this.timeout(13000);
        var stopTest = false;

        var map = client.getMap(mapName);
        var ignoredKey = mapSize;

        var populatePromises = [];
        for (var i = 0; i < mapSize; i++) {
            populatePromises.push(map.put(i, i));
        }
        populatePromises.push(map.put(ignoredKey, ignoredKey));

        function compareActualAndExpected(actualMap, verificationMap, index) {
            return actualMap.get(index).then(function (actual) {
                return verificationMap.get(index).then(function (expected) {
                    return expect(actual).to.equal(expected);
                });
            });
        }

        function populateNearCacheAndCompare() {
            if (!stopTest) {
                var promises = [];
                for (var i = 0; i < mapSize; i++) {
                    promises.push(map.get(i));
                }
                Promise.all(promises).then(function() {
                    setTimeout(populateNearCacheAndCompare, 0);
                });
            } else {
                var comparisonPromises = [];
                for (var i = 0; i < mapSize; i++) {
                    comparisonPromises.push(compareActualAndExpected(map, validationClient.getMap(mapName), i));
                }
                Promise.all(comparisonPromises).then(() => {done()}).catch(done);
            }
        }

        Promise.all(populatePromises).then(function () {
            map.executeOnKey(ignoredKey, new DistortInvalidationMetadataEntryProcessor(mapName, mapSize, 5)).then(function () {
                stopTest = true;
            }).catch(function (err) {
                done(err);
            });
            setTimeout(populateNearCacheAndCompare, 100);
        })

    });
});
