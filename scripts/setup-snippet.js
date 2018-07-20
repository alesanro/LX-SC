## Contract Owner

./node_modules/.bin/truffle console --network ntr1x

const confirmationWorkflowFlag = web3.toBigNumber(2).pow(255);
const tmWorkflow = web3.toBigNumber(1)
const tmWithConfirmationWorkflow1 = tmWorkflow.add(confirmationWorkflowFlag)
const fixedPriceWorkflow = web3.toBigNumber(2)

web3.eth.getAccounts((e,a) => console.log(a))
web3.eth.getBalance("0xfebc7d461b970516c6d3629923c73cc6475f1d13", (e,b) => console.log(b))

web3.eth.sendTransaction({from: "0xfebc7d461b970516c6d3629923c73cc6475f1d13", to:"0x00bd07e19ff6257156ce71368c315e61f900142d", value:web3.toWei(10, "ether")}, (e,r) => console.log(r))
web3.eth.sendTransaction({from: "0xfebc7d461b970516c6d3629923c73cc6475f1d13", to:"0x005bd4cb3cb08f92a3f34fc5a970f133405188af", value:web3.toWei(10, "ether")}, (e,r) => console.log(r))
web3.eth.sendTransaction({from: "0xfebc7d461b970516c6d3629923c73cc6475f1d13", to:"0x00aabd706f4ee7ec560517f82a1d492b21fef05e", value:web3.toWei(10, "ether")}, (e,r) => console.log(r))
web3.eth.sendTransaction({from: "0xfebc7d461b970516c6d3629923c73cc6475f1d13", to:"0x003045868e9b5405f710643d1b31dab330b186ec", value:web3.toWei(10, "ether")}, (e,r) => console.log(r))
web3.eth.sendTransaction({from: "0xfebc7d461b970516c6d3629923c73cc6475f1d13", to:"0x00b436db5bd741285b98d6bcf488eceadb4c410e", value:web3.toWei(10, "ether")}, (e,r) => console.log(r))
web3.eth.sendTransaction({from: "0xfebc7d461b970516c6d3629923c73cc6475f1d13", to:"0x002abe91a1a77ea4c2529f9a3498dae735adac33", value:web3.toWei(10, "ether")}, (e,r) => console.log(r))

web3.eth.getBalance("0x00bd07e19ff6257156ce71368c315e61f900142d", (e,b) => console.log(b))
web3.eth.getBalance("0x005bd4cb3cb08f92a3f34fc5a970f133405188af", (e,b) => console.log(b))
web3.eth.getBalance("0x00aabd706f4ee7ec560517f82a1d492b21fef05e", (e,b) => console.log(b))
web3.eth.getBalance("0x003045868e9b5405f710643d1b31dab330b186ec", (e,b) => console.log(b))
web3.eth.getBalance("0x00b436db5bd741285b98d6bcf488eceadb4c410e", (e,b) => console.log(b))
web3.eth.getBalance("0x002abe91a1a77ea4c2529f9a3498dae735adac33", (e,b) => console.log(b))


Roles2Library.deployed().then(r => r.setRootUser("0x00bd07e19ff6257156ce71368c315e61f900142d", true));

const ModeratorRole = 10;
const WorkerRole = 21;
BoardController.deployed().then(b => console.log(b.contract.createBoard.getData(0,0,0,0).slice(0,10)))
BoardController.deployed().then(b => console.log(b.contract.closeBoard.getData(0).slice(0,10)))

Roles2Library.deployed().then(r => r.addRoleCapability(ModeratorRole, BoardController.address, "0x1d132702"));
Roles2Library.deployed().then(r => r.addRoleCapability(ModeratorRole, BoardController.address, "0x210c1f29"));

UserFactory.deployed().then(f => console.log(f.contract.createUserWithProxyAndRecovery.getData(0x0, 0x0, []).slice(0,10)))
Recovery.deployed().then(r => console.log(r.contract.recoverUser.getData(0x0, 0x0).slice(0,10)))

Roles2Library.deployed().then(r => r.addRoleCapability(ModeratorRole, UserFactory.address, "0x5be62401"));
Roles2Library.deployed().then(r => r.addRoleCapability(ModeratorRole, Recovery.address, "0x722c1809"));

UserFactory.deployed().then(f => f.createUserWithProxyAndRecovery("0x003045868e9b5405f710643d1b31dab330b186ec", Recovery.address, [WorkerRole,])) // By anyone

// User: 0x4a7018836d7f6d14cb0e1bf1c7ba36498c495cad
// UserProxy: 0xf7658f6cfdbaa8c35675f0b2995cfae13599ed09

UserLibrary.deployed().then(u => u.setSkills("0xf7658f6cfdbaa8c35675f0b2995cfae13599ed09", 16, 16, 16)) // for UserProxy address

UserLibrary.deployed().then(u => u.setSkills("0x00aabd706f4ee7ec560517f82a1d492b21fef05e", 16, 16, 16))
UserLibrary.deployed().then(u => u.setSkills("0x00aabd706f4ee7ec560517f82a1d492b21fef05e", 64, 64, 64))

UserLibrary.deployed().then(u => u.getUserSkills.call("0xf7658f6cfdbaa8c35675f0b2995cfae13599ed09")).then(r => console.log(`${JSON.stringify(r, null, 4)}`))
UserLibrary.deployed().then(u => u.getUserSkills.call("0x003045868e9b5405f710643d1b31dab330b186ec"))

// UserLibrary.deployed().then(u => u.setSkills("0x003045868e9b5405f710643d1b31dab330b186ec", 16, 16, 16))
// UserLibrary.deployed().then(u => u.setSkills("0xf7658f6cfdbaa8c35675f0b2995cfae13599ed09", 64, 64, 64))


## Admin (0x00bd07e19ff6257156ce71368c315e61f900142d)

Roles2Library.deployed().then(r => r.addUserRole("0x005bd4cb3cb08f92a3f34fc5a970f133405188af", ModeratorRole))

## Moderator (0x005bd4cb3cb08f92a3f34fc5a970f133405188af)

// "Developers", "Developers Board Description"
BoardController.deployed().then(b => b.createBoard(1, 1, 1, 0))
// "Tech Writers", "Tech Writers Board Description"
BoardController.deployed().then(b => b.createBoard(1, 1, 1, 0))

BoardController.deployed().then(b => b.bindJobWithBoard(1, 5))
BoardController.deployed().then(b => b.bindJobWithBoard(1, 6))
BoardController.deployed().then(b => b.bindJobWithBoard(1, 7))
BoardController.deployed().then(b => b.bindJobWithBoard(1, 8))

BoardController.deployed().then(b => b.bindJobWithBoard(2, 1))
BoardController.deployed().then(b => b.bindJobWithBoard(2, 2))
BoardController.deployed().then(b => b.bindJobWithBoard(2, 3))

## Client (0x00b436db5bd741285b98d6bcf488eceadb4c410e)

// For test

JobController.deployed().then(j => j.postJob(tmWithConfirmationWorkflow1,4,4,4,10,"0x001"))
JobController.deployed().then(j => j.postJob(tmWithConfirmationWorkflow1,4,4,4,20,"0x002"))
JobController.deployed().then(j => j.postJob(tmWithConfirmationWorkflow1,4,4,4,30,"0x003"))
JobController.deployed().then(j => j.postJob(tmWithConfirmationWorkflow1,4,4,4,40,"0x004"))
JobController.deployed().then(j => j.postJob(tmWithConfirmationWorkflow1,64,64,64,50,"0x005"))
JobController.deployed().then(j => j.postJob(tmWithConfirmationWorkflow1,16,16,16,60,"0x006"))
JobController.deployed().then(j => j.postJob(tmWithConfirmationWorkflow1,16,16,16,70,"0x007"))
JobController.deployed().then(j => j.postJob(tmWithConfirmationWorkflow1,16,16,16,80,"0x008"))
JobController.deployed().then(j => j.postJob(tmWithConfirmationWorkflow1,16,16,16,90,"0x009"))
JobController.deployed().then(j => j.postJob(tmWithConfirmationWorkflow1,16,16,16,90,"0x009"))
JobController.deployed().then(j => j.postJob(fixedPriceWorkflow,16,16,16,1200,"0x0010"))
JobController.deployed().then(j => j.postJob(fixedPriceWorkflow,16,16,16,1000,"0x0011"))
JobController.deployed().then(j => j.postJob(fixedPriceWorkflow,16,16,16,1000,"0x0012"))

var offerPayment
JobController.deployed().then(j => j.calculateLockAmountFor("0x00aabd706f4ee7ec560517f82a1d492b21fef05e", 5)).then(r => offerPayment = r)
JobController.deployed().then(j => j.acceptOffer(5, "0x00aabd706f4ee7ec560517f82a1d492b21fef05e", { value: offerPayment, }))
JobController.deployed().then(j => j.calculateLockAmountFor("0xf7658f6cfdbaa8c35675f0b2995cfae13599ed09", 10)).then(r => offerPayment = r)
JobController.deployed().then(j => j.acceptOffer(10, "0xf7658f6cfdbaa8c35675f0b2995cfae13599ed09", { value: offerPayment, }))
JobController.deployed().then(j => j.cancelJob(5))


JobController.deployed().then(j => j.confirmStartWork(6))
JobController.deployed().then(j => j.rejectWorkResults(10))


## Worker 1 (0x00aabd706f4ee7ec560517f82a1d492b21fef05e)
JobController.deployed().then(j => j.postJobOffer(5, 10, 10, 10))
JobController.deployed().then(j => j.postJobOffer(6, 20, 20, 20))
JobController.deployed().then(j => j.postJobOffer(7, 20, 20, 20))
JobController.deployed().then(j => j.postJobOffer(8, 20, 20, 20))
JobController.deployed().then(j => j.postJobOffer(9, 20, 20, 20))

JobController.deployed().then(j => j.startWork(6))


## Worker 2 (0x003045868e9b5405f710643d1b31dab330b186ec)
## User 2 (0x4a7018836d7f6d14cb0e1bf1c7ba36498c495cad)

JobController.deployed().then(j => j.contract.postJobOffer.getData(6, 20, 20, 20)).then(data => Promise.resolve().then(() => User.at("0x4a7018836d7f6d14cb0e1bf1c7ba36498c495cad").forward(JobController.address, data, 0, true)))

JobsDataProvider.deployed().then(p => p.getJobOffersCount(6)).then(r => r.toString())
JobsDataProvider.deployed().then(p => p.getJobOffers(10, 0, 100)).then(r => console.log(`${JSON.stringify(r, null, 4)}`))

JobController.deployed().then(j => j.contract.postJobOfferWithPrice.getData(10, 1500)).then(data => Promise.resolve().then(() => User.at("0x4a7018836d7f6d14cb0e1bf1c7ba36498c495cad").forward(JobController.address, data, 0, true)))

JobController.deployed().then(j => j.contract.startWork.getData(10)).then(data => Promise.resolve().then(() => User.at("0x4a7018836d7f6d14cb0e1bf1c7ba36498c495cad").forward(JobController.address, data, 0, true)))
JobController.deployed().then(j => j.contract.endWork.getData(10)).then(data => Promise.resolve().then(() => User.at("0x4a7018836d7f6d14cb0e1bf1c7ba36498c495cad").forward(JobController.address, data, 0, true)))
