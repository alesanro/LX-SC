"use strict";
const JobController = artifacts.require('./JobController.sol');

const ERC20Library = artifacts.require('./ERC20Library.sol');
const Roles2Library = artifacts.require('./Roles2Library.sol');
const UserLibrary = artifacts.require('./UserLibrary.sol');
const StorageManager = artifacts.require('./StorageManager.sol');
const MultiEventsHistory = artifacts.require('./MultiEventsHistory.sol');
const PaymentProcessor = artifacts.require('./PaymentProcessor.sol');

module.exports = deployer => {
    const JobControllerRole = 35;
    let jobController;
    let rolesLibrary;
    let paymentProcessor;

    deployer
    .then(() => StorageManager.deployed())
    .then(storageManager => storageManager.giveAccess(JobController.address, 'JobController'))
    .then(() => MultiEventsHistory.deployed())
    .then((multiEventsHistory) => multiEventsHistory.authorize(JobController.address))
    .then(() => JobController.deployed())
    .then(_jobController => jobController = _jobController)
    .then(() => jobController.setupEventsHistory(MultiEventsHistory.address))
    .then(() => jobController.setPaymentProcessor(PaymentProcessor.address))
    .then(() => jobController.setUserLibrary(UserLibrary.address))
    .then(() => Roles2Library.deployed())
    .then(_roles2Library => rolesLibrary = _roles2Library)
    .then(() => PaymentProcessor.deployed())
    .then(_paymentProcessor => paymentProcessor = _paymentProcessor)
    .then(() => {
        let sig = paymentProcessor.contract.lockPayment.getData(0, 0, 0, 0).slice(0, 10);
        return rolesLibrary.addRoleCapability(JobControllerRole, PaymentProcessor.address, sig)
    })
    .then(() => {
        let sig = paymentProcessor.contract.releasePayment.getData(0, 0, 0, 0, 0, 0, 0).slice(0, 10);
        return rolesLibrary.addRoleCapability(JobControllerRole, PaymentProcessor.address, sig)
    })
    .then(() => rolesLibrary.addUserRole(JobController.address, JobControllerRole))
    .then(() => console.log("[Migration] JobController #initialized"));
};
