# Experience Cloud Donation Flows for Fundraising for UK
[![Deploy to Salesforce](https://app.jdeploy.cloud/images/flat.svg)](https://app.jdeploy.cloud/github/FinDockLabs/experience-cloud-donation-flows-fundraising-uk/main)
This repository contains Flow templates to help you get started with building digital payment experiences using Experience Cloud and FinDock Payment Experiences. The flow included are designed for Salesforce Fundraising:
Donation flow: Screen flow with a multi step donation process, includes setting Gift Tributes and donor covering fees.

This template is meant to be customized and extended to fit specific use cases and requirements. For other options, see [Templates for FinDock Payment Experiences](https://github.com/FinDockLabs/experience-cloud-templates). 

*Key features*
Collect one-time and recurring donations
Configurable amounts and frequencies
Collect Gift Aid from UK donors

## Prerequisites
- FinDock is installed and configured.
- FinDock for Fundraising is installed and configured.
- At least one payment extension is installed and configured.
- Digital Experiences is enabled in the org.


## Installation
1. Press the buttons to deploy the repo to the org.
2. Follow [these instructions](https://help.salesforce.com/s/articleView?id=experience.rss_flow_guestuser.htm&type=5) to set up the guest user access for the flow. Do this for Dontation_Flow.
3. Go to the donation Flow -> Payment Screen -> Payment Method Selection component
   - configure at least some payment methods
4. Configure the [payment intent](https://docs.findock.com/docs/july-26/payments/pay-button) (add at least a success and failure URLs and verify the mapping matches your use case).
6. Activate your flow.
7. Go to the Experience Cloud Administration -> Preferences -> enable "Allow guest users to access public APIs".
8. Add the flow to your Experience Cloud site.
