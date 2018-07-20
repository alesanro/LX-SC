"use strict";
const PaymentProcessor = artifacts.require('./PaymentProcessor.sol');
const Roles2Library = artifacts.require('./Roles2Library.sol');
const PaymentGateway = artifacts.require('./PaymentGateway.sol');

module.exports = deployer => {
    const PaymentProcessorRole = 34;
    let rolesLibrary;
    let paymentGateway

    deployer
    .then(() => PaymentProcessor.deployed())
    .then(paymentProcessor => paymentProcessor.setPaymentGateway(PaymentGateway.address))
    .then(() => Roles2Library.deployed())
    .then(_roles2Library => rolesLibrary = _roles2Library)
    .then(() => PaymentGateway.deployed())
    .then(_paymentGateway => paymentGateway = _paymentGateway)
    // .then(() => {
    //     let sig = paymentGateway.contract.transfer.getData(0,0,0,0).slice(0, 10);
    //     return rolesLibrary.addRoleCapability(PaymentProcessorRole, PaymentGateway.address, sig);
    // })
    .then(() => {
        let sig = paymentGateway.contract.transferWithFee.getData(0,0,0,0).slice(0, 10);
        return rolesLibrary.addRoleCapability(PaymentProcessorRole, PaymentGateway.address, sig);
    })
    // .then(() => {
    //     var sig = paymentGateway.contract.transferFromMany.getData([],0,[]).slice(0, 10);
    //     return rolesLibrary.addRoleCapability(PaymentProcessorRole, PaymentGateway.address, sig);
    // })
    .then(() => {
        let sig = paymentGateway.contract.transferToMany.getData(0,[],[],0,0).slice(0, 10);
        return rolesLibrary.addRoleCapability(PaymentProcessorRole, PaymentGateway.address, sig);
    })
    .then(() => {
        let sig = paymentGateway.contract.transferAll.getData(0,0,0,0,0,0).slice(0, 10);
        return rolesLibrary.addRoleCapability(PaymentProcessorRole, PaymentGateway.address, sig);
    })
    .then(() => {
        let sig = paymentGateway.contract.transferAllAndWithdraw.getData(0,0,0,0,0,0,0).slice(0, 10);
        return rolesLibrary.addRoleCapability(PaymentProcessorRole, PaymentGateway.address, sig);
    })
    .then(() => rolesLibrary.addUserRole(PaymentProcessor.address, PaymentProcessorRole))
    .then(() => console.log("[Migration] PaymentProcessor #initialized"))
};
