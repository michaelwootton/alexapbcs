"use strict";

/**
 * "hello.world" custom component.
 */
const HelloWorldComponent = {
  metadata: () => ({
    name: 'hello.world',
    properties: {
      name: {required: true, type: 'string'}
    },
    supportedActions: []
  }),
  invoke: (conversation, done) => {
    // read 'hello' variable
    const hi = conversation.variable('hello') || 'Hi';
    // create response
    conversation.reply(`${hi} ${conversation.properties().name}.`);
    // transition state
    conversation.transition();
    done();
  }
};
module.exports = HelloWorldComponent;
