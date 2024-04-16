_These examples are not production-ready and are to be used as a starting point for those looking to automate the ability to keep Stripe and Moesif in sync as users top-up their balances in Stripe. If used in production, proper security mechanisms for authentication and authorization should be added_

## Background
With Moesif's new Credit Consumption feature, Moesif is now able to independently track consumption usage and burn down a pre-paid balance. For instance, if a user adds $10 in API usage credits, Moesif can keep track of their remaining balance in real-time, helping to more accurately enforce access to the API if no credits remain and many other use cases.

With this feature, users will still want to process payments and balances in a 3rd party billing platform, like Stripe. This requires additional logic to ensure that any credits purchased through Stripe, or another billing provider, are then applied to the balance within Moesif. If a user adds $10 in Stripe, that same amount should be added to their available balance within Moesif as well.

This can be done in multiple ways and this is the reasoning behind the examples in this project. Within the project, you will see 3 potential ways that such mechanisms can be implemented with Stripe. These include a webhook, API, and combined approach. Below is some detail on how each of the solutions works, how to customize them, and how to run them.

## The Applications

### Webhook-only App
With this approach, whenever a user's balance changes in Stripe, a corresponding debit or credit will be added to the Moesif balance. Using the Stripe webhook, when a change is sent, the record will be created and sent to Moesif via the Moesif Credit Consumption API.

This approach works well for applications that already have an existing top-up flow built and allows for minimal changes. This approach is automated and allows both balances to stay in sync between the two systems.

The webhook application in this example (`webhook-app.js`) will receive a message from Stripe when a user has added funds to their Stripe account. To start this example, you can use:

`node webhook-app.js`

For this application to work you must deploy the webhook somewhere (for example, for testing you could use ngrok or deploy on your existing API infrastructure). It needs to be a publicly accessible webhook. Once deployed, add the webhook to Stripe by going to the __Developers__ menu. Then go to __Webhooks > Add endpoints__. 

On the next screen, you'll add your endpoint URL in the __Endpoint URL__ field, such as `https://mycompany.com/webhook`. Then, you'll need to also click the __Select events__ button, selecting the following events for the webhook:

- payment_intent.succeeded

Once configured, click __Add endpoint__.

To test this, go through your top-up logic and ensure that the webhook fires and successfully creates the credit/debit entry in Moesif (you will be able to see the debugger output in your APIs console as well).

### API-only App
If you are building or have an existing top-up flow, you can also do the same logic as above by using a direct API call to Moesif's Credit Consumption endpoints. In this example, there is an API app that allows users to call a /top-up endpoint with their Stripe customer ID and the amount they would like to credit to their account. 

The endpoint itself then creates a Stripe __PaymentIntent__ that will then add the amount to the user's Stripe account. At the same time, this endpoint will also go and create a corresponding transaction on the Moesif side, adding the amount to the available balance in Moesif.

The endpoint can be deployed independently or on your existing API infrastructure, however, this __endpoint requires users to have a credit card on file__ and will create a Stripe Payment Intent for the amount they have requested to be charged against that card. To run the API, use the following command:

`node webhook-api-app.js`

### Webhook + API App
For users who want to use the best of both solutions, this example allows users to create an endpoint to initiate the top-up transaction and then use the webhook to apply that credit on the Moesif side once the PaymentIntent has succeeded on the Stripe side.

The webhook will require the same configuration as the initial webhook above, the same goes for the API. Currently, in this solution, both the /top-up REST API endpoint and the webhook run in the same node project, however, both of these can be split apart as needed. 

The node app will need to be hosted publicly, but to test functionality locally, you can use the following command:

`node webhook-api-app.js`

## Configuring the .env
Depending on the project, the .env file that the projects use require the following values:

``` conf
STRIPE_API_KEY="sk_test_51KgE2......"
STRIPE_ENDPOINT_SECRET="whsec_teSTkeY......"
MOESIF_API_URL="https://api.moesif.com/~/billing/reports/balance_transactions"
MOESIF_MANAGEMENT_TOKEN="Bearer eyMoeSIfkEY......"
```

Here is how to get the values for each of these configuration items:

__STRIPE_API_KEY__
The Stripe API we are using requires an API key. The API keys can be provisioned in a few ways, the [Stripe docs](https://docs.stripe.com/keys) cover this well.

__STRIPE_ENDPOINT_SECRET__
The Webhook project requires a Webhook Secret. This can be retrieved in the Stripe UI through the Webhooks screen. Here are the [Stripe docs](https://docs.stripe.com/webhooks#endpoint-secrets) for more particulars.

__MOESIF_API_URL__
This can be left as is, pointing the the credit consumption endpoint available through the Moesif Management API.

__MOESIF_MANAGEMENT_TOKEN__
A Moesif Management Token must be provisioned in order to use the Management API. This can be done using the Moesif UI to provision a [Management API Token](https://www.moesif.com/docs/api#management-api). This will require the following scopes for the token:

- create:billing_meters 
- create:billing_reports