"use strict";
const UserFactory = artifacts.require('./UserFactory.sol');
const Roles2Library = artifacts.require('./Roles2Library.sol');
const MultiEventsHistory = artifacts.require('./MultiEventsHistory.sol');

module.exports = deployer => {
    let userFactory;
    let rolesLibrary; 

    deployer
    .then(() => Roles2Library.deployed())
    .then(_roles2Library => rolesLibrary = _roles2Library)
    .then(() => UserFactory.deployed())
    .then(_userFactory => userFactory = _userFactory)
    .then(() => userFactory.setupEventsHistory(MultiEventsHistory.address))
    .then(() => MultiEventsHistory.deployed())
    .then(multiEventsHistory => multiEventsHistory.authorize(UserFactory.address))

    .then(() => console.log("[Migration] UserFactory #initialized"))
};
