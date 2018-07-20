"use strict";
const Storage = artifacts.require('Storage');

module.exports = deployer => {
    deployer.deploy(Storage)
    .then(() => console.log("[Migration] Storage #deployed"))
};
