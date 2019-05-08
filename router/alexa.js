
// third party
const _ = require("underscore");
const alexa = require("alexa-app");
const express = require('express');
const PubSub = require('pubsub-js');
// OracleBot SDK
const OracleBot = require('@oracle/bots-node-sdk');
const { WebhookClient } = OracleBot.Middleware;
const { messageModelUtil, textUtil } = OracleBot.Util;

// configurations
const Config = require('../config');
var userlocale = '';
var userId = '';
/**
 * Alexa skill integration class
 */
class AlexaIntegration {
  /**
   * Construct the alexa integration with its associative configurations
   * @param {object} config - integration configuration
   * @param {object} config.endpoints - endpoint configurations
   * @param {object} config.env - environment property configurations (see README.md)
   * @param {object} [config.logger] - optional custom logging utility
   */
  constructor(config) {
    PubSub.immediateExceptions = true;
    // process configurations
    this.logger = config.logger || console;
    this.endpoints = config.endpoints;
    this.env = config.env;
    // init router
    this.router = express.Router();
    this._initWebhook()._initAlexa();
  }

  /**
   * expose router middleware
   */
  middleware() {
    return this.router;
  }

  // #########################
  //      WebhookClient
  // #########################
  
  _initWebhook() {
    // init client
    this.webhook = new WebhookClient({ 
    // determine the channel config on incoming request from ODA
    channel: (req) => {
      console.log('Here', req.params);
      const { locale } = req.params;
      var url = '';
      var secret = '';

      switch(locale) {
        case 'es': {
          // ...
           url = 'http://2b2d3e3d.ngrok.io/connectors/v1/tenants/chatbot-tenant/listeners/webhook/channels/26d19683-0bcd-4bbb-8d0e-f125529039ec';
           secret= 'Wv6cSP9yyGk9PAMoE6YxWGa1AWk3Eebz';
           this.logger.info('Channel being used-ES : ', url);		  
           break;
        }   
        case 'pt': {
          // ...
           url= 'http://2b2d3e3d.ngrok.io/connectors/v1/tenants/chatbot-tenant/listeners/webhook/channels/3d51ca51-ca5a-4802-bcb2-2b5e52d9e6b5';
           secret= 'uqalyRoRzS1LvzorZCpu7BYANLzvYJ6T';
           this.logger.info('Channel being used-PT : ', url);		  
          break;
        }  
      }
      return {
        url,
        secret,
      };
    },
  });

    
  this.webhook
  .on(WebhookEvent.ERROR, err => this.logger.error('Error:', err.message))
  .on(WebhookEvent.MESSAGE_SENT, message => this.logger.info('Message to chatbot:', message));
  
    // add webhook receiver at the configured endpoint '/messages'
    this.logger.info(`Bot webhook outbound messages: /alexa${this.endpoints.webhook}`);
    this.router.post('/bot/message/:locale', this.webhook.receiver((req, res) => {
      const { locale } = req.params;
	  res.send(200);
      const body = req.body;
      const userId = body.userId;
      this.logger.info("Publishing to", userId);
      PubSub.publish(userId, body);
    }));
    return this;
  }

  // #########################
  //          Alexa
  // #########################
  
  _initAlexa() {
    const self = this;
    const logger = this.logger;
    const MessageModel = this.webhook.MessageModel();

    const metadata = { // map for compatibility to copied sample
      channelUrl: this.env.WEBHOOK_CHANNEL_URL,
      channelSecretKey: this.env.WEBHOOK_SECRET,
      waitForMoreResponsesMs: this.env.WEBHOOK_WAIT_MS,
    };

    this.logger.info(`Alexa skill endpoint: /alexa/${this.endpoints.skill}`);
    this.alexa = new alexa.app(this.endpoints.skill);

    // code (mostly) included from alexa singleBot sample
    this.alexa.intent("CommandBot", {}, (alexa_req, alexa_res) => {
      var command = alexa_req.slot("command");
      var session = alexa_req.getSession();
      let userId = session.get("userId");
      if (!userId) {
        //userId = session.details.userId;
        userId = session.details.user.userId;
        if (!userId) {
          userId = self.randomIntInc(1000000, 9999999).toString();
        }
        session.set("userId", userId);
      }
	  this.logger.info('Got query : ', alexa_req.query);
    this.logger.info('qual a conversation total : ', JSON.stringify(alexa_req));
	  
      alexa_res.shouldEndSession(false);
      if (userId && command) {  
        const userIdTopic = userId;
        var respondedToAlexa = false;
        var additionalProperties = {
          profile: {
            clientType: "alexa",
			locale: userlocale
          }
        };
        var sendToAlexa = (resolve) => {
          if (!respondedToAlexa) {
            respondedToAlexa = true;
            logger.info('Prepare to send to Alexa');
            //alexa_res.send();
            resolve();
            PubSub.unsubscribe(userIdTopic);
          } else {
            logger.info("Already sent response");
          }
        };
          // compose text response to alexa, and also save botMessages and botMenuResponseMap to alexa session so they can be used to control menu responses next
        var navigableResponseToAlexa = (resp) => {
          var respModel;
          if (resp.messagePayload) {
            respModel = new MessageModel(resp.messagePayload);
          } else {
            // handle 1.0 webhook format as well
            respModel = new MessageModel(resp);
          }
          var botMessages = session.get("botMessages");
          if (!Array.isArray(botMessages)) {
            botMessages = [];
          }
          var botMenuResponseMap = session.get("botMenuResponseMap");
          if (typeof botMenuResponseMap !== 'object') {
            botMenuResponseMap = {};
          }
          botMessages.push(respModel.messagePayload());
          session.set("botMessages", botMessages);
          session.set("botMenuResponseMap", Object.assign(botMenuResponseMap || {}, self.menuResponseMap(respModel.messagePayload())));
          let messageToAlexa = messageModelUtil.convertRespToText(respModel.messagePayload());
          logger.info("Message to Alexa (navigable):", messageToAlexa)
          alexa_res.say(messageToAlexa);
        };

        var sendMessageToBot = (messagePayload) => {
          logger.info('Creating new promise for', messagePayload);
          return new Promise(function(resolve, reject){
            var commandResponse = function (msg, data) {
              logger.info('Received callback message from webhook channel');
              var resp = data;
              logger.info('Parsed Message Body:', resp);
              if (!respondedToAlexa) {
                navigableResponseToAlexa(resp);
              } else {
                logger.info("Already processed response");
                return;
              }
              if (metadata.waitForMoreResponsesMs) {
                _.delay(function () {
                  sendToAlexa(resolve, reject);
                }, metadata.waitForMoreResponsesMs);
              } else {
                sendToAlexa(resolve, reject);
              }
            };
            // var token = PubSub.subscribe(userIdTopic, commandResponse);
            PubSub.subscribe(userIdTopic, commandResponse);
            // use webhook client to send
            const message = _.assign({ userId, messagePayload }, additionalProperties);
            self.webhook.send(message)
              .catch(err => {
                logger.info("Failed sending message to Bot");
                alexa_res.say("Failed sending message to Bot.  Please review your bot configuration.");
                reject(err);
                PubSub.unsubscribe(userIdTopic);
              })
            // self.sendWebhookMessageToBot(metadata.channelUrl, metadata.channelSecretKey, userId, messagePayload, additionalProperties, function (err) {
            //   if (err) {
            //     logger.info("Failed sending message to Bot");
            //     alexa_res.say("Failed sending message to Bot.  Please review your bot configuration.");
            //     reject();
            //     PubSub.unsubscribe(userIdTopic);
            //   }
            // });
          });
        };

        var handleInput = function (input) {
          var botMenuResponseMap = session.get("botMenuResponseMap");
          if (typeof botMenuResponseMap !== 'object') {
            botMenuResponseMap = {};
          }
          var menuResponse = textUtil.approxTextMatch(input, _.keys(botMenuResponseMap), true, true, .7);
          var botMessages = session.get("botMessages");
          //if command is a menu action
          if (menuResponse) {
            var menu = botMenuResponseMap[menuResponse.item];
            // if it is global action or message level action
            if (['global', 'message'].includes(menu.type)) {
              var action = menu.action;
              session.set("botMessages", []);
              session.set("botMenuResponseMap", {});
              if (action.type === 'postback') {
                var postbackMsg = MessageModel.postbackConversationMessage(action.postback);
                return sendMessageToBot(postbackMsg);
              } else if (action.type === 'location') {
                logger.info('Sending a predefined location to bot');
                return sendMessageToBot(MessageModel.locationConversationMessage(37.2900055, -121.906558));
              }
              // if it is navigating to card detail
            } else if (menu.type === 'card') {
              var selectedCard;
              if (menu.action && menu.action.type && menu.action.type === 'custom' && menu.action.value && menu.action.value.type === 'card') {
                selectedCard = _.clone(menu.action.value.value);
              }
              if (selectedCard) {
                if (!Array.isArray(botMessages)) {
                  botMessages = [];
                }
                var selectedMessage;
                if (botMessages.length === 1) {
                  selectedMessage = botMessages[0];
                } else {
                  selectedMessage = _.find(botMessages, function (botMessage) {
                    if (botMessage.type === 'card') {
                      return _.some(botMessage.cards, function (card) {
                        return (card.title === selectedCard.title);
                      });
                    } else {
                      return false;
                    }
                  });
                }
                if (selectedMessage) {
                  //session.set("botMessages", [selectedMessage]);
                  session.set("botMenuResponseMap", self.menuResponseMap(selectedMessage, selectedCard));
                  let messageToAlexa = messageModelUtil.cardToText(selectedCard, 'Card');
                  logger.info("Message to Alexa (card):", messageToAlexa)
                  alexa_res.say(messageToAlexa);
                  return alexa_res.send();
                }
              }
              // if it is navigating back from card detail
            } else if (menu.type === 'cardReturn') {
              var returnMessage;
              if (menu.action && menu.action.type && menu.action.type === 'custom' && menu.action.value && menu.action.value.type === 'messagePayload') {
                returnMessage = _.clone(menu.action.value.value);
              }
              if (returnMessage) {
                //session.set("botMessages", [returnMessage]);
                session.set("botMenuResponseMap", _.reduce(botMessages, function(memo, msg){
                  return Object.assign(memo, self.menuResponseMap(msg));
                }, {}));
                //session.set("botMenuResponseMap", menuResponseMap(returnMessage));
                _.each(botMessages, function(msg){
                  let messageToAlexa = messageModelUtil.convertRespToText(msg);
                  logger.info("Message to Alexa (return from card):", messageToAlexa);
                  alexa_res.say(messageToAlexa);
                })
                return alexa_res.send();
              }
            }
          } else {
            var commandMsg = MessageModel.textConversationMessage(command);
            return sendMessageToBot(commandMsg);
          }
        };
        return handleInput(command);
      } else {
        _.defer(function () {
          alexa_res.say("I don't understand. Could you please repeat what you want?");
          //alexa_res.send();
        });
      }
      //return false;
    }
    );

    this.alexa.intent("AMAZON.StopIntent", {}, (alexa_req, alexa_res) => {
      alexa_res.say("Goodbye");
      alexa_res.shouldEndSession(true);
    });

    this.alexa.launch((alexa_req, alexa_res) => {
      var session = alexa_req.getSession();
      session.set("startTime", Date.now());
      alexa_res.say("Welcome to SingleBot");
    });

    this.alexa.pre = (alexa_req, alexa_res/*, alexa_type*/) => {
      logger.debug(alexa_req.data.session.application.applicationId);
      const amzn_appId = this.env.AMZN_SKILL_ID;
      if (alexa_req.data.session.application.applicationId != amzn_appId) {
        logger.error("fail as application id is not valid");
        alexa_res.fail("Invalid applicationId");
      }
      logger.info(JSON.stringify(alexa_req.data, null, 4));
      if (!metadata.channelUrl || !metadata.channelSecretKey) {
        var message = "The singleBot cannot respond.  Please check the channel and secret key configuration.";
        alexa_res.fail(message);
        logger.info(message);
      }
    };
    //alexa_app.express(alexaRouter, "/", true);
    this.alexa.express({router: this.router, checkCert: false});
    return this;
  }

  randomIntInc(low, high) {
    return Math.floor(Math.random() * (high - low + 1) + low);
  }

  // compile the list of actions, global actions and other menu options
  menuResponseMap(resp, card) {
    var responseMap = {};

    function addToMap (label, type, action) {
      responseMap[label] = {type: type, action: action};
    }

    if (!card) {
      if (resp.globalActions && resp.globalActions.length > 0) {
        resp.globalActions.forEach(function (gAction) {
          addToMap(gAction.label, 'global', gAction);
        });
      }
      if (resp.actions && resp.actions.length > 0) {
        resp.actions.forEach(function (action) {
          addToMap(action.label, 'message', action);
        });
      }
      if (resp.type === 'card' && resp.cards && resp.cards.length > 0) {
        resp.cards.forEach(function (card) {
          //special menu option to navigate to card detail
          addToMap('Card ' + card.title, 'card', {type: 'custom', value: {type: 'card', value: card}});
        });
      }
    } else {
      if (card.actions && card.actions.length > 0) {
        card.actions.forEach(function (action) {
          addToMap(action.label, 'message', action);
        });
      }
      //special menu option to return to main message from the card
      addToMap('Return', 'cardReturn', {type: 'custom', value: {type: 'messagePayload', value: resp}});
    }
    return responseMap;
  }

  


  // #########################
}

// instantiate and export
module.exports = new AlexaIntegration({
  env: Config.get('env'),
  endpoints: Config.get('endpoints.alexa'),
  logger: Config.get('logger'),
}).middleware();