const jobControllerFlagsFunc = require('../common/jobControllerFlags')

const Roles2Library = artifacts.require("Roles2Library")
const BoardController = artifacts.require("BoardController")
const UserRegistry = artifacts.require("UserRegistry")
const UserInterface = artifacts.require("UserInterface")

function getAccount() {
	return new Promise((resolve, reject) => {
		web3.eth.getAccounts((e, accounts) => (e === null || e === undefined) ? resolve(accounts[0]) : reject)
	})
}

module.exports = async (callback) => {

	const jobControllerFlags = jobControllerFlagsFunc(web3)
	const roles2Library = await Roles2Library.deployed()
	const boardController = await BoardController.deployed()
	const userRegistry = await UserRegistry.deployed()

	const account = await getAccount()
	const users = await userRegistry.getUserContracts(account)

	console.log(`Active account ${account}, has users: ${users}`)

	const user = await UserInterface.at(users[0])
	if (!(await roles2Library.hasUserRole(user.address, jobControllerFlags.roles.moderator))) {
		callback(`Logged in user ${user.address} is not a moderator.`)
		return
	}

	console.log(`Board created ${JSON.stringify(await user.forward(boardController.address, boardController.contract.createBoard.getData(1,1,1,0), 0, true))}`)
	console.log(`Now board counts ${await boardController.getBoardsCount()}`)

	callback()
}