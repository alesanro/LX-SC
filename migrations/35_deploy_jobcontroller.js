"use strict";
const JobController = artifacts.require('./JobController.sol');
const JobWorkInitiationControllerLib = artifacts.require("JobWorkInitiationControllerLib")
const JobWorkProcessControllerLib = artifacts.require("JobWorkProcessControllerLib")
const JobWorkAcceptanceControllerLib = artifacts.require("JobWorkAcceptanceControllerLib")
const Roles2Library = artifacts.require('./Roles2Library.sol');
const Storage = artifacts.require('./Storage.sol');

module.exports = deployer => {
    deployer.then(async () => {
        await deployer.deploy(JobWorkInitiationControllerLib)
        await deployer.deploy(JobWorkProcessControllerLib)
        await deployer.deploy(JobWorkAcceptanceControllerLib)

        await deployer.deploy(JobController, Storage.address, 'JobController', Roles2Library.address)

        let jobController = await JobController.deployed()
        await jobController.init()

        console.log("[Migration] JobController #deployed")
	})
};
