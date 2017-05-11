const UserProxyTester = artifacts.require('./UserProxyTester.sol');
const EventsHistory = artifacts.require('./EventsHistory.sol');
const Reverter = require('./helpers/reverter');
const User = artifacts.require('./User.sol');

contract('User', function(accounts) {
  const reverter = new Reverter(web3);
  afterEach('revert', reverter.revert);

  let user;
  let tester;

  before('setup', () => {
    return User.deployed()
    .then(instance => user = instance)
    .then(() => UserProxyTester.deployed())
    .then(instance => tester = instance)
    .then(() => user.setRecoveryContract(accounts[1]))
    .then(reverter.snapshot);
  });

  it('should set proxy', () => {
    const address = '0xffffffffffffffffffffffffffffffffffffffff';
    return user.setUserProxy(address)
    .then(() => user.getUserProxy())
    .then(result => assert.equal(result, address));
  });

  it('should not set proxy when called by not-owner', () => {
    const address = '0xffffffffffffffffffffffffffffffffffffffff';
    return user.setUserProxy(address, {from: accounts[1]})
    .then(() => user.getUserProxy())
    .then(result => assert.equal(result, '0x0000000000000000000000000000000000000000'));
  });

  it('should forward and return value', () => {
    const data = tester.contract.forward.getData();;
    return user.setUserProxy(tester.address)
    .then(() => user.forward.call(tester.address, data, 0, false))
    .then(result => assert.equal(result, '0x3432000000000000000000000000000000000000000000000000000000000000'));
    //tester as userProxy always returns same number
  });

  it('should not forward when called by not-owner', () => {
    const data = tester.contract.functionReturningValue.getData();
    return user.setUserProxy(tester.address)
    .then(() => user.forward.call(tester.address, data, 0, false, {from: accounts[1]}))
    .then(result => assert.equal(result, '0x0000000000000000000000000000000000000000000000000000000000000000'));
  });

  it('should recover user', () => {
    const newUser = '0xffffffffffffffffffffffffffffffffffffffff';
    return user.recoverUser(newUser, {from: accounts[1]})
    .then(() => user.contractOwner())
    .then(result => assert.equal(result, '0xffffffffffffffffffffffffffffffffffffffff'));
  });

  it('should not recover user if called not by recovery', () => {
    const newUser = '0xffffffffffffffffffffffffffffffffffffffff';
    return user.recoverUser(newUser)
    .then(() => user.contractOwner())
    .then(result => assert.equal(result, accounts[0]));
  });
});
