# Oracle Bots Sample: Custom Components, Webhook -> Alexa

Key application features demonstrated from
[`@oracle/bots-node-sdk`](https://www.npmjs.com/package/@oracle/bots-node-sdk):

- Application setup with [`OracleBot.init()`](https://oracle.github.io/bots-node-sdk/global.html#init)
- Custom services using [`customComponent`](https://oracle.github.io/bots-node-sdk/module-Middleware.html#.customComponent) middleware
- [`WebhookClient`](https://oracle.github.io/bots-node-sdk/module-Middleware.WebhookClient.html) channel integration

## Usage

```text
npm install
npm start
```

### Configurations

The application runtime supports the use of the following environment variables
for its deployment configuration. For endpoint and routing configurations, refer
to [`config.json`](./config/config.json)

| Variable | Description |
| -- | -- |
| `AMZN_SKILL_ID` | The app (skill) identifier available at _[View Skill ID](https://developer.amazon.com/alexa/console/ask)_ |
| `WEBHOOK_CHANNEL_URL` | URL for the Bots Webhook _Incoming_ message channel |
| `WEBHOOK_SECRET` | Secret key associated with the Webhook channel configuration |
| `WEBHOOK_WAIT_MS` | A wait period to accept multiple messages from the webhook channel before sending to alexa |

> **TIP:** Add a `.env` property file in the application root for a local
environment configuration. This file should be ignored by `.git`. See
[dotenv](https://www.npmjs.com/package/dotenv#usage) for more information

### Endpoints

| URL | Description |
| -- | -- |
| `/components` | Custom Component API services |
| `/alexa/messages` | Outbound endpoint for Alexa Webhook channel configuration |
| `/alexa/app` | URL for Alexa skill in the Amazon portal |

## Deployment

The project is designed for deployment to an Oracle Application Container Cloud
instance, and contains a `manifest.json` and archiving utilities for the same.

1. Create an archive `npm run zip`
1. Upload resulting `accspackage.zip` to an Application Container Cloud instance