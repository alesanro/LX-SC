"use strict";

const UserBackend = artifacts.require("UserBackend")

module.exports = deployer => {
	deployer.then(async () => {
		await deployer.deploy(UserBackend)

		console.log("[Migration] UserBackend #deployed")
	})
}