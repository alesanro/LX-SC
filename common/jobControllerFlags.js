module.exports = function (web3) {
	const flags = {
		confirmationNeeded: web3.toBigNumber(2).pow(255),
	}
	
	const workflows = {
		tm: web3.toBigNumber(1), // time & material
		fixedPrice: web3.toBigNumber(2), // fixed price
	}

	return {
		flags: flags,
		workflows: {
			tm: {
				optionalConfirmation: workflows.tm,
				requiredConfirmation: workflows.tm.add(flags.confirmationNeeded),
			},
			fixedPrice: {
				noConfirmation: workflows.fixedPrice
			},
		},
		roles: {
			moderator: web3.toBigNumber(10),
			worker: web3.toBigNumber(21),

		}
	}
}