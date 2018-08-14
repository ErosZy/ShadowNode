'use strict';
// Flags: --expose-gc


var assert = require('assert');
var theError = new Error('Some error');

// The test module throws an error during Init, but in order for its exports to
// not be lost, it attaches them to the error's "bindings" property. This way,
// we can make sure that exceptions thrown during the module initialization
// phase are propagated through require() into JavaScript.
// https://github.com/nodejs/node/issues/19437
var test_exception = (function() {
  var resultingException;
  try {
    require(`./build/Release/test_exception.node`);
  } catch (anException) {
    resultingException = anException;
  }
  assert.strictEqual(resultingException.message, 'Error during Init');
  return resultingException.binding;
})();

{
  var throwTheError = () => { throw theError; };

  // Test that the native side successfully captures the exception
  var returnedError = test_exception.returnException(throwTheError);
  assert.strictEqual(theError, returnedError);

  // Test that the native side passes the exception through
  assert.throws(
    () => { test_exception.allowException(throwTheError); },
    (err) => err === theError
  );

  // Test that the exception thrown above was marked as pending
  // before it was handled on the JS side
  var exception_pending = test_exception.wasPending();
  assert.strictEqual(exception_pending, true,
                     'Exception not pending as expected,' +
                     ` .wasPending() returned ${exception_pending}`);

  // Test that the native side does not capture a non-existing exception
  returnedError = test_exception.returnException(common.mustCall());
  assert.strictEqual(returnedError, undefined,
                     'Returned error should be undefined when no exception is' +
                     ` thrown, but ${returnedError} was passed`);
}

{
  // Test that no exception appears that was not thrown by us
  var caughtError;
  try {
    test_exception.allowException(common.mustCall());
  } catch (anError) {
    caughtError = anError;
  }
  assert.strictEqual(caughtError, undefined,
                     'No exception originated on the native side, but' +
                     ` ${caughtError} was passed`);

  // Test that the exception state remains clear when no exception is thrown
  var exception_pending = test_exception.wasPending();
  assert.strictEqual(exception_pending, false,
                     'Exception state did not remain clear as expected,' +
                     ` .wasPending() returned ${exception_pending}`);
}

// Make sure that exceptions that occur during finalization are propagated.
function testFinalize(binding) {
  var x = test_exception[binding]();
  x = null;
  assert.throws(() => { global.gc(); }, /Error during Finalize/);

  // To assuage the linter's concerns.
  (function() {})(x);
}
testFinalize('createExternal');
testFinalize('createExternalBuffer');
