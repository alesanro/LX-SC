"use strict";
const Storage = artifacts.require('./Storage.sol');
const StorageManager = artifacts.require('./StorageManager.sol');

module.exports = deployer => {
    deployer.deploy(StorageManager)
    .then(() => console.log("[Migration] StorageManager #deployed"))

    .then(() => Storage.deployed())
    .then(storage => storage.setManager(StorageManager.address))
    .then(() => console.log("[Migration] StorageManager #initialized"));
};
