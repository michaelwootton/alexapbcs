"use strict";

const Tester = require("@oracle/bots-node-sdk/testing");
const HelloWorldComponent = require('../../../components/hello.world');

describe('HelloWorldComponent', () => {
  // test with any payload
  it('should respond to a simple request', done => {
    const conv = Tester.MockConversation.any();
    HelloWorldComponent.invoke(conv, (err) => {
      expect(err).toBeUndefined();
      expect(conv.getReplies()).toBeDefined();
      expect(conv.getReplies().length).toBeGreaterThan(0);
      done();
    });
  });

  // test with specific properties
  it('should respond to a request with params', done => {
    // create a conversation payload iwth properties and variables
    const properties = { name: 'Unit Tester' };
    const variables = { hello: 'Howdy' };
    const request = Tester.MockRequest(null, properties, variables);
    const conv = Tester.MockConversation.fromRequest(request);

    // stub/watch the variable method
    const varSpy = spyOn(conv, 'variable').and.callThrough();

    // invoke the component
    HelloWorldComponent.invoke(conv, (err) => {
      expect(err).toBeUndefined();
      expect(conv.getReplies()).toBeDefined();
      // check that the spy was called
      expect(varSpy).toHaveBeenCalledTimes(1);

      // make assertions on the responses
      const reply = conv.getReplies()[0];
      expect(Reflect.has(reply.messagePayload, 'text')).toBe(true);
      expect(reply.messagePayload.text).toEqual('Howdy Unit Tester.');

      done();
    });
  });


});
