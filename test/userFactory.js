const EventsHistory = artifacts.require('./EventsHistory.sol');
const UserLibraryMock = artifacts.require('./UserLibraryMock.sol');
const UserFactory = artifacts.require('./UserFactory.sol');
const Reverter = require('./helpers/reverter');

contract('UserFactory', function(accounts) {
  const reverter = new Reverter(web3);
  afterEach('revert', reverter.revert);

  let userFactory;
  let callCounter;
  let recovery = "0xffffffffffffffffffffffffffffffffffffffff";

  before('setup', () => {
    return UserFactory.deployed()
    .then(instance => userFactory = instance)
    .then(() => EventsHistory.deployed())
    .then(instance => eventsHistory = instance)
    .then(() => userFactory.setupEventsHistory(eventsHistory.address))
    .then(() => UserLibraryMock.deployed())
    .then(instance => callCounter = instance)
    .then(() => userFactory.setupUserLibrary(callCounter.address))
    .then(reverter.snapshot);
  });

  it('should create users without roles and skills', () => {
    return userFactory.createUserWithProxyAndRecovery(recovery, [], '', [], [])
    .then(result => {
      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, 'UserCreated');
      assert.equal(result.logs[0].args.roles.length, 0);
      assert.equal(result.logs[0].args.areas.toString(), '0');
      assert.equal(result.logs[0].args.categories.length, 0);
      assert.equal(result.logs[0].args.skills.length, 0); 
      assert.equal(result.logs[0].args.recoveryContract, recovery);
      assert.isNotNull(result.logs[0].args.proxy);
      assert.isNotNull(result.logs[0].args.users);
    })
    .then(() => callCounter.getCalls())
    .then(array => {
      assert.equal(array[0].toString(), '0');
      assert.equal(array[1].toString(), '0');
    });
  });

  it('should create user with roles', () => {
    let roles = ['0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff','0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00'];
    return userFactory.createUserWithProxyAndRecovery(recovery, roles, '', [], [])
    .then(result => {
      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, 'UserCreated');
      assert.deepEqual(result.logs[0].args.roles, roles);
      assert.equal(result.logs[0].args.areas.toString(), '0');
      assert.equal(result.logs[0].args.categories.length, 0);
      assert.equal(result.logs[0].args.skills.length, 0);
      assert.equal(result.logs[0].args.recoveryContract, recovery);
      assert.isNotNull(result.logs[0].args.proxy);
      assert.isNotNull(result.logs[0].args.users);
    })
    .then(() => callCounter.getCalls())
    .then(array => {
      assert.equal(array[0].toString(), '2');
      assert.equal(array[1].toString(), '0');
    });
  });

  it('should create users with skills', () => {
    let areas = 10;
    let categories = [1, 2];
    let skills = [1];
    return userFactory.createUserWithProxyAndRecovery(recovery, [], areas, categories, skills)
    .then(result => {
      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, 'UserCreated');
      assert.equal(result.logs[0].args.roles.length, 0);
      assert.equal(result.logs[0].args.areas.toString(2), '1010');
      assert.equal(result.logs[0].args.categories.length, 2);
      assert.equal(result.logs[0].args.skills.length, 1);
      assert.equal(result.logs[0].args.recoveryContract, recovery);
      assert.isNotNull(result.logs[0].args.proxy);
      assert.isNotNull(result.logs[0].args.users);
    })
    .then(() => callCounter.getCalls())
    .then(array => {
      assert.equal(array[0].toString(), '0');
      assert.equal(array[1].toString(), '1');
    });
  });

  it('should create users with skills and roles', () => {
    let roles = ['0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff','0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00'];
    let areas = 10;
    let categories = [1, 2];
    let skills = [1];
    return userFactory.createUserWithProxyAndRecovery(recovery, roles, areas, categories, skills)
    .then(result => {
      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, 'UserCreated');
      assert.deepEqual(result.logs[0].args.roles, roles);
      assert.equal(result.logs[0].args.areas.toString(2), '1010');
      assert.equal(result.logs[0].args.categories.length, 2);
      assert.equal(result.logs[0].args.skills.length, 1);
      assert.equal(result.logs[0].args.recoveryContract, recovery);
      assert.isNotNull(result.logs[0].args.proxy);
      assert.isNotNull(result.logs[0].args.users);
    })
    .then(() => callCounter.getCalls())
    .then(array => {
      assert.equal(array[0].toString(), '2');
      assert.equal(array[1].toString(), '1');
    });
  });

})
