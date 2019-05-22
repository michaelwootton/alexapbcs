
// third party
const _ = require('underscore');
const alexa = require('alexa-app');
const express = require('express');
const PubSub = require('pubsub-js');
const leven = require('leven');
// OracleBot SDK
const OracleBot = require('@oracle/bots-node-sdk');
const { WebhookClient } = OracleBot.Middleware;
// I took out this modules, and brought the function to the end of this code
//const { messageModelUtil } = require('../lib/messageModel/messageModelUtil.js');
//const {textUtil} = require('../lib/messageModel/textUtil.js');
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
        this.logger.info('Here', req.params);
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

    
    // add webhook receiver at the configured endpoint '/messages'
    this.logger.info('Bot webhook outbound messages: /alexa${this.endpoints.webhook}');
    this.router.post('/message/:locale', this.webhook.receiver((req, res) => {
      const { locale } = req.params;
      res.send(200);
      const body = req.body;
      const userId = body.userId;
      this.logger.info('Publishing to', userId);
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
    this.alexa.intent('CommandBot', {}, (alexa_req, alexa_res) => {
      var command = alexa_req.slot('command');
      var session = alexa_req.getSession();
      let userId = session.get('userId');
      if (!userId) {
        //userId = session.details.userId;
        userId = session.details.user.userId;
        if (!userId) {
          userId = self.randomIntInc(1000000, 9999999).toString();
        }
        session.set('userId', userId);
      }
	    logger.info('Got locale : ', alexa_req.data.request.locale);
      logger.info('qual a conversation total : ', JSON.stringify(alexa_req));
      userlocale = alexa_req.data.request.locale;
      //as the Chatbot has only resource Bundles for es-Es or es-419 (Mexico), transform to es-419
      if (userlocale.substring(0,2) === 'es') {userlocale = 'es-419'};
      // set initial channel to portuguese CHATBOT	
      var channeloc= {
        url: 'http://2b2d3e3d.ngrok.io/connectors/v1/tenants/chatbot-tenant/listeners/webhook/channels/3d51ca51-ca5a-4802-bcb2-2b5e52d9e6b5',
        secret: 'uqalyRoRzS1LvzorZCpu7BYANLzvYJ6T',
      };   
      if (userlocale.substring(0,2) === 'pt') {
        channeloc= {
          url: 'http://2b2d3e3d.ngrok.io/connectors/v1/tenants/chatbot-tenant/listeners/webhook/channels/3d51ca51-ca5a-4802-bcb2-2b5e52d9e6b5',
          secret: 'uqalyRoRzS1LvzorZCpu7BYANLzvYJ6T',
        };
        logger.info('Channel being used: ', channeloc);
      }
  // if Spanish - set channel to Spanish CHATBOT	
      else if (userlocale.substring(0,2) === 'es') {
        channeloc = {
          url: 'http://2b2d3e3d.ngrok.io/connectors/v1/tenants/chatbot-tenant/listeners/webhook/channels/26d19683-0bcd-4bbb-8d0e-f125529039ec',
           secret: 'Wv6cSP9yyGk9PAMoE6YxWGa1AWk3Eebz',
        };
        logger.info('Channel being used: ', channeloc);
      }  

      if (userId && command) {  
        const userIdTopic = userId;
        var respondedToAlexa = false;
        var additionalProperties = {
          profile: {
            clientType: 'alexa',
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
            logger.info('Already sent response');
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
          var botMessages = session.get('botMessages');
          if (!Array.isArray(botMessages)) {
            botMessages = [];
          }
          var botMenuResponseMap = session.get('botMenuResponseMap');
          if (typeof botMenuResponseMap !== 'object') {
            botMenuResponseMap = {};
          }
          if (typeof resp.body.messagePayload.channelExtensions === 'undefined') {
            alexa_res.shouldEndSession(false);
          }
          else {
            alexa_res.shouldEndSession(true);
          }          
          botMessages.push(respModel.messagePayload());
          session.set('botMessages', botMessages);
          session.set('botMenuResponseMap', Object.assign(botMenuResponseMap || {}, self.menuResponseMap(respModel.messagePayload())));
          logger.info('Message to Alexa (antes de converter para texto):', respModel.messagePayload());
          let messageToAlexa = convertRespToText(respModel.messagePayload());
          logger.info('Message to Alexa (navigable):', messageToAlexa);
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
                logger.info('Already processed response');
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
            logger.info('Message sent to Chatbot: ', message);
            logger.info('Channel used on send: ', channeloc);
            self.webhook.send(message, channeloc)
              .catch(err => {
                logger.info('Failed sending message to Bot');
                if (userlocale.substring(0,2) == 'pt') {
                    alexa_res.say('Falhou enviando mensagem para o Bot.  Por favor revise as configurações do seu BOT.');
                }
                else if (userlocale.substring(0,2) == 'en') {
                    alexa_res.say('Failed sending a message to the BOT. Please review the configurations of your BOT.'); 
                }
                else if (userlocale.substring(0,2) == 'es') {
                    alexa_res.say('El envío de mensaje para el BOT falló.  Por favor revise las configuraciones de su BOT.');
                }                  
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
          logger.info('\n Entrou no handleinput');
          var botMenuResponseMap = session.get('botMenuResponseMap');
          if (typeof botMenuResponseMap !== 'object') {
            botMenuResponseMap = {};
          }
          var menuResponse = approxTextMatch(input, _.keys(botMenuResponseMap), true, true, .7);
          var botMessages = session.get('botMessages');
          //if command is a menu action
          if (menuResponse) {
            var menu = botMenuResponseMap[menuResponse.item];
            // if it is global action or message level action
            if (['global', 'message'].includes(menu.type)) {
              var action = menu.action;
              session.set('botMessages', []);
              session.set('botMenuResponseMap', {});
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
                  //session.set('botMessages', [selectedMessage]);
                  session.set('botMenuResponseMap', self.menuResponseMap(selectedMessage, selectedCard));
                  let messageToAlexa = cardToText(selectedCard, 'Card');
                  logger.info('Message to Alexa (card):', messageToAlexa)
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
                //session.set('botMessages', [returnMessage]);
                session.set('botMenuResponseMap', _.reduce(botMessages, function(memo, msg){
                  return Object.assign(memo, self.menuResponseMap(msg));
                }, {}));
                //session.set('botMenuResponseMap', menuResponseMap(returnMessage));
                _.each(botMessages, function(msg){
                  let messageToAlexa = convertRespToText(msg);
                  logger.info('Message to Alexa (return from card):', messageToAlexa);
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
          if (userlocale.substring(0,2) == 'pt') {
            alexa_res.say('Não compreendo, Voce poderia por favor repetir o que deseja? ');
          }
          else if (userlocale.substring(0,2) == 'en') {
            alexa_res.say("I don't understand. Could you please repeat what you want?"); 
          }
          else if (userlocale.substring(0,2) == 'es')  {
            alexa_res.say('No compreendo, Podría por favor repetir lo que desea?');
          }  			          
          //alexa_res.send();
        });
      }
      //return false;
    });

    this.alexa.intent('AMAZON.CancelIntent', {}, (alexa_req, alexa_res) => {
      logger.info('\n Entrou no STOPINTENT');
      var command = 'cancel';
      var session = alexa_req.getSession();
      let userId = session.get('userId');
      if (!userId) {
        userId = session.details.user.userId;
        if (!userId) {
          userId = self.randomIntInc(1000000, 9999999).toString();
        }
        session.set('userId', userId);
      }
      userlocale = alexa_req.data.request.locale;
      //as the Chatbot has only resource Bundles for es-Es or es-419 (Mexico), transform to es-419
      if (userlocale.substring(0,2) === 'es') {userlocale = 'es-419'};
      // set initial channel to portuguese CHATBOT	
      var channeloc= {
        url: 'http://2b2d3e3d.ngrok.io/connectors/v1/tenants/chatbot-tenant/listeners/webhook/channels/3d51ca51-ca5a-4802-bcb2-2b5e52d9e6b5',
        secret: 'uqalyRoRzS1LvzorZCpu7BYANLzvYJ6T',
      };   
      if (userlocale.substring(0,2) === 'pt') {
        channeloc= {
          url: 'http://2b2d3e3d.ngrok.io/connectors/v1/tenants/chatbot-tenant/listeners/webhook/channels/3d51ca51-ca5a-4802-bcb2-2b5e52d9e6b5',
          secret: 'uqalyRoRzS1LvzorZCpu7BYANLzvYJ6T',
        };
        logger.info('Channel being used: ', channeloc);
      }
  // if Spanish - set channel to Spanish CHATBOT	
      else if (userlocale.substring(0,2) === 'es') {
        channeloc = {
          url: 'http://2b2d3e3d.ngrok.io/connectors/v1/tenants/chatbot-tenant/listeners/webhook/channels/26d19683-0bcd-4bbb-8d0e-f125529039ec',
           secret: 'Wv6cSP9yyGk9PAMoE6YxWGa1AWk3Eebz',
        };
        logger.info('Channel being used: ', channeloc);
      }  

      if (userId && command) {  
        const userIdTopic = userId;
        var respondedToAlexa = false;
        var additionalProperties = {
          profile: {
            clientType: 'alexa',
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
            logger.info('Already sent response');
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
          var botMessages = session.get('botMessages');
          if (!Array.isArray(botMessages)) {
            botMessages = [];
          }
          var botMenuResponseMap = session.get('botMenuResponseMap');
          if (typeof botMenuResponseMap !== 'object') {
            botMenuResponseMap = {};
          }
          if (typeof resp.body.messagePayload.channelExtensions === 'undefined') {
            alexa_res.shouldEndSession(false);
          }
          else {
            alexa_res.shouldEndSession(true);
          }
          		
          botMessages.push(respModel.messagePayload());
          session.set('botMessages', botMessages);
          session.set('botMenuResponseMap', Object.assign(botMenuResponseMap || {}, self.menuResponseMap(respModel.messagePayload())));
          logger.info('Message to Alexa (antes de converter para texto):', respModel.messagePayload());
          let messageToAlexa = convertRespToText(respModel.messagePayload());
          logger.info('Message to Alexa (navigable):', messageToAlexa);
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
                logger.info('Already processed response');
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
            logger.info('Message sent to Chatbot: ', message);
            logger.info('Channel used on send: ', channeloc);
            self.webhook.send(message, channeloc)
            .catch(err => {
                logger.info('Failed sending message to Bot');
                alexa_res.shouldEndSession(true);
                if ( userlocale.substring(0,2) === 'pt') {
                    alexa_res.say('Falhou enviando mensagem para o Bot.  Por favor revise as configurações do seu BOT.');
                }
                else if (userlocale.substring(0,2) === 'en') {
                    alexa_res.say('Failed sending a message to the BOT. Please review the configurations of your BOT.'); 
                }
                else if (userlocale.substring(0,2) === 'es') {
                    alexa_res.say('El envío de mensaje para el BOT falló.  Por favor revise las configuraciones de su BOT.');
                }                  
                reject(err);
                PubSub.unsubscribe(userIdTopic);
            })

          });
        };

        var handleInput = function (input) {
            var commandMsg = MessageModel.textConversationMessage('cancel');
            return sendMessageToBot(commandMsg);
          }
        return handleInput(command);
      } else {
        _.defer(function () {
          alexa_res.shouldEndSession(false);
          if (userlocale.substring(0,2) === 'pt-BR') {
            alexa_res.say('Não compreendo, Voce poderia por favor repetir o que deseja? ');
          }
          else if (userlocale.substring(0,2) === 'en') {
            alexa_res.say("I don't understand. Could you please repeat what you want?"); 
          }
          else if (userlocale.substring(0,2) === 'es')  {
            alexa_res.say('No compreendo, Podría por favor repetir lo que desea?');
          }  			          
          //alexa_res.send();
        });
      }
      //return false;
    
    });

    this.alexa.launch((alexa_req, alexa_res) => {
      var session = alexa_req.getSession();
      session.set('startTime', Date.now());
      userlocale = alexa_req.data.request.locale;
      alexa_res.shouldEndSession(false);
      if (userlocale.substring(0,2) === 'pt-BR') {
        alexa_res.say('Bemvindo ao Alexa Bot');
      }
      else if (userlocale.substring(0,2) === 'en') {
        alexa_res.say("Welcome to Alexa Bot"); 
      }
      else if (userlocale.substring(0,2) === 'es') {
        alexa_res.say('Bienvenido a Alexa Bot');
      }  			                
    });

    this.alexa.pre = (alexa_req, alexa_res/*, alexa_type*/) => {
      logger.debug(alexa_req.data.session.application.applicationId);
      const amzn_appId = this.env.AMZN_SKILL_ID;
      if (alexa_req.data.session.application.applicationId != amzn_appId) {
        logger.error('fail as application id is not valid');
        alexa_res.shouldEndSession(true);
        
        if (userlocale.substring(0,2) === 'pt') {
          alexa_res.fail('Código de Aplicação Inválido');
        }
        else if (userlocale.substring(0,2) === 'en') {
          alexa_res.fail('Invalid applicationId'); 
        }
        else if (userlocale.substring(0,2) === 'es')  {
          alexa_res.fail('Código de Aplicación Inválido');
        }  			                 
      }
      logger.info(JSON.stringify(alexa_req.data, null, 4));
      userlocale = alexa_req.data.request.locale;
      if (!metadata.channelUrl || !metadata.channelSecretKey) {
        var message = 'The singleBot cannot respond.  Please check the channel and secret key configuration';
        if (userlocale.substring(0,2) === 'pt') {
          var message = 'O Alexa Bot não consegue responder. Por favor verifique a configuração do Canal e da chave secreta';
        }
        else if (userlocale.substring(0,2) === 'en') {
          var message = "The singleBot cannot respond.  Please check the channel and secret key configuration"; 
        }
        else if (userlocale.substring(0,2) === 'es')  {
          var message = 'El Alexa Bot no consigue contestar. Por favor verifique la configuración del canal y de la llave secreta';
        }  			                 
        alexa_res.shouldEndSession(true);
        alexa_res.fail(message);
        logger.info(message);
      }
    };
    //alexa_app.express(alexaRouter, '/', true);
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


//functions that were in oraclebots/Util but I bought to here 
// I took of the phrases telling there are options to choose

function trailingPeriod(text) {
  if (!text || (typeof text !== 'string')) {
    return '';
  }
  return ((text.trim().endsWith('.') || text.trim().endsWith('?') || text.trim().endsWith(',')) ? text.trim() + ' ' : text.trim() + ' ');
}

function actionToText(action, actionPrefix) {
  var actionText = (actionPrefix ? actionPrefix + ' ' : '');
  if (action.label) {
    return actionText + action.label;
  }
  else {
    switch (action.type) {
    case 'postback':
      break;
    case 'call':
        if (userlocale.substring(0,2) === 'pt') {
          actionText += 'Chame o fone de numero ' + action.phoneNumber;
        }
        else if (userlocale.substring(0,2) === 'es') {
          actionText += 'Llame el telefono con numero ' + action.phoneNumber;
        }
        else if (userlocale.substring(0,2) === 'en')  {
          actionText += 'Call the telephone with number ' + action.phoneNumber;
        }			                 
      
      break;
    case 'url':
        if (userlocale.substring(0,2) === 'pt-BR') {
          actionText += 'Abra a URL ' + action.url;
        }
        else if (userlocale.substring(0,2) === 'es-ES')  {
          actionText += 'Abra el sitio URL ' + action.url;
        }
        else if (userlocale.substring(0,2) === 'en-US')  {
          actionText += 'Open the URL ' + action.url;
        }
      break;
    case 'share':
        if (userlocale.substring(0,2) === 'pt') {
          actionText += 'Compartilhe a mensagem ';
        }
        else if (userlocale.substring(0,2) === 'es') {
          actionText += 'Comparte el mensaje ';
        }  
        else if (userlocale.substring(0,2) === 'en') {
          actionText += 'Share the Message ';
        }  
      break;
    case 'location':
        if (userlocale.substring(0,2) === 'pt') {
          actionText += 'Compartilhe a localização ';
        }
        else if (userlocale.substring(0,2) === 'es')  {
          actionText += 'Comparte la ubicación ';
        }  
        else if (userlocale.substring(0,2) === 'en')  {
          actionText += 'Share the location ';        
        } 
      break;
    default:
      break;
    }
  }
  return actionText;
}

function actionsToText(actions, prompt, actionPrefix) {
/*  var actionsText = prompt || 'You can choose from the following actions: '; */
  var actionsText = prompt || ' ';
  actions.forEach(function (action, index) {
    actionsText = actionsText + actionToText(action, actionPrefix);
    if (index < actions.length - 1) {
      actionsText = actionsText + ', ';
    }
  });
  return trailingPeriod(actionsText);
}

function textMessageToText(resp) {
  var result = "";
  result = trailingPeriod(resp.text);
  if (resp.actions && resp.actions.length > 0) {
/*    result = result + actionsToText(resp.actions, 'You can choose from the following options: '); */
    result = result + actionsToText(resp.actions, ' ');
  }
  if (resp.globalActions && resp.globalActions.length > 0) {
/*    result = result + actionsToText(resp.globalActions, 'The following global actions are available: '); */
    result = result + actionsToText(resp.globalActions, ' ');
  }
  return result;
}

/**
 * utility function to derive a string representation of a card within a conversation message for use with speech or text based channels like Alexa and SMS.
 * @function module:Util/MessageModel.cardToText
 * @return {string} A string or speech representation of the card.
 * @param {object} card - A card (as defined in Conversation Message Model)
 * @param {string} [cardPrefix] - A string prefix used before the card content, for example 'Card'
 */
function cardToText(card, cardPrefix) {
  var cardText = trailingPeriod((cardPrefix ? cardPrefix + ' ' : '') + card.title);
  if (card.description) {
    cardText = trailingPeriod(cardText + card.description);
  }
  if (card.actions && card.actions.length > 0) {
    if (userlocale.substring(0,2) === 'pt') {
      cardText = cardText + actionsToText(card.actions, 'As seguintes ações estão disponíveis para estar card: ');
      cardText = cardText + ' O escoja Return';
    }
    else if (userlocale.substring(0,2) === 'es')  {
      cardText = cardText + actionsToText(card.actions, 'Las seguientes acciones estan disponibles para este card: ');
      cardText = cardText + ' O escoja Return';
    }  
    else if (userlocale.substring(0,2) === 'en')  {
      cardText = cardText + actionsToText(card.actions, 'The following actions are available for this card: ');
      cardText = cardText + ' Or choose Return';      
    }     
  }
  else {
    if (userlocale.substring(0,2) === 'pt') {
      cardText = cardText + ' Poderia escolher Return';
    }
    else if (userlocale.substring(0,2) === 'es')  {
      cardText = cardText + ' Podrias esocojer Return';
    }  
    else if (userlocale.substring(0,2) === 'en')  {
      cardText = cardText + ' You could choose Return';    
    }     
  }
  return cardText;
}

function cardsSummaryToText(cards, prompt) {

    if (userlocale.substring(0,2) === 'pt') {
      var cardsText = prompt || 'Voce pode escolher dos seguintes cards para mais informação: ';  
          }
    else if (userlocale.substring(0,2) === 'es')  {
      var cardsText = prompt || 'Tu podrias esojer de los seguinentes cards para más informaciones: ';  
    }  
    else if (userlocale.substring(0,2) === 'en')  {
      var cardsText = prompt || 'You can choose from the following cards for more information: ';  
    }  
    cards.forEach(function (card, index) {
    cardsText = cardsText + 'Card ' + card.title;
    if (index < cards.length - 1) {
      cardsText = cardsText + ', ';
    }
  });
  return trailingPeriod(cardsText);
}

function cardMessageToText(resp) {
  var result = "";
  result = trailingPeriod(resp.text);
  if (resp.cards && resp.cards.length > 0) {
    result = result + cardsSummaryToText(resp.cards);
  }
  if (resp.actions && resp.actions.length > 0) {
/*    result = result + actionsToText(resp.actions, 'The following options are available: '); */
    result = result + actionsToText(resp.actions, ' ');
  }
  return trailingPeriod(result);
}

function attachmentMessageToText(resp) {
  var result = "";
  if (resp.actions && resp.actions.length > 0) {
/*    result = result + actionsToText(resp.actions, 'You can choose from the following options: '); */
    result = result + actionsToText(resp.actions, ' ');
  }
  if (resp.globalActions && resp.globalActions.length > 0) {
/*    result = result + actionsToText(resp.globalActions, 'The following global actions are available: '); */
    result = result + actionsToText(resp.globalActions, ' ');
  }
  return trailingPeriod(result);
}
/**
 * utility function to derive a string representation of a Conversation Message for use with speech or text based channels like Alexa and SMS.
 * @function module:Util/MessageModel.convertRespToText
 * @return {string} A string or speech representation of the conversation message.
 * @param {object} convMsg - A message conforming to Conversation Message Model.
 */
function convertRespToText(convMsg) {
  var sentence = '';
  if (convMsg.type) {
    switch (convMsg.type) {
    case 'text':
      sentence = textMessageToText(convMsg);
      break;
    case 'card':
      sentence = cardMessageToText(convMsg);
      break;
    case 'attachment':
      sentence = attachmentMessageToText(convMsg);
      break;
    case 'location':
      sentence = attachmentMessageToText(convMsg);
      break;
    }
  }
  return sentence;
}


function approxTextMatch(item, list, lowerCase, removeSpace, threshold) {
  function preProcess(item) {
    if (removeSpace) {
      item = item.replace(/\s/g, '');
    }
    if (lowerCase) {
      item = item.toLowerCase();
    }
    return item;
  }
  var matched = false;
  var matchedItem = null;
  var itemProcessed = preProcess(item);
  var result = list.map(function (listItem) {
    var listItemProcessed = preProcess(listItem);
    if (itemProcessed === listItemProcessed) {
      matchedItem = {
        exactMatch: true,
        similarity: 1,
        item: listItem
      };
      matched = true;
      return matchedItem;
    }
    const L = Math.max(itemProcessed.length, listItemProcessed.length);
    const similarity = (L - leven(itemProcessed, listItemProcessed)) / L;
    return {
      similarity,
      exactMatch: false,
      item: listItem
    };
  });
  if (!matched) {
    // console.log(result);
    matchedItem = result.reduce((prev, current) => {
      return ((prev && current.similarity > prev.similarity) ? current : prev) || current;
    }, null);
    if (matchedItem && matchedItem.similarity >= (threshold)) {
      return matchedItem;
    }
    else {
      return null;
    }
  }
  else {
    return matchedItem;
  }
}