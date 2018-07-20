"use strict";
const UserProxyTester = artifacts.require('UserProxyTester');
const UserMock = artifacts.require('UserMock');
const Mock = artifacts.require('Mock');
const ManagerMock = artifacts.require('ManagerMock');
const UserLibraryMock = artifacts.require('UserLibraryMock');
const Storage = artifacts.require('Storage');

module.exports = (deployer, network) => {
    if (network === "development") {
        deployer.deploy(UserProxyTester)
        .then(() => deployer.deploy(UserMock))
        .then(() => deployer.deploy(Mock))
        .then(() => deployer.deploy(ManagerMock))
        .then(() => deployer.deploy(UserLibraryMock))
        .then(() => console.log("[Migration] Testnet #deployed"));
    }
};
