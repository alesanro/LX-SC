"use strict";
const JobController = artifacts.require('./JobController.sol');
const ERC20Library = artifacts.require('./ERC20Library.sol');
const Roles2Library = artifacts.require('./Roles2Library.sol');
const Storage = artifacts.require('./Storage.sol');

module.exports = deployer => {
    deployer.deploy(JobController, Storage.address, 'JobController', Roles2Library.address, ERC20Library.address)
    .then(() => console.log("[Migration] JobController #deployed"))
};
