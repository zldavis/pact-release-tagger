import got from "got";
import core from "@actions/core";

const pactBrokerUrl = core.getInput("PACT_BROKER_URL", { required: true });
const pactToken = core.getInput("PACT_TOKEN", { required: true });
const provider = core.getInput("PACT_PROVIDER", { required: true });
const releaseBranch = core.getInput('RELEASE_BRANCH', { required: true });

console.log(`Fetching pacts for ${provider}`);

const res = await got({
  method: "POST",
  url: `${pactBrokerUrl}/pacts/provider/${provider}/for-verification`,
  json: {
    providerVersionBranch: "master",
    consumerVersionSelectors: [{ branch: "master", all: false }]
  },
  headers: {
    "Accept": "application/hal+json",
    "Authorization": `Bearer ${pactToken}`,
    "Content-Type": "application/json",
  },
}).json();

const pactLinks = res._embedded.pacts.map(pact => pact._links.self.href);

console.log(`Found ${pactLinks.length} pacts for ${provider}`);

const pacts = await Promise.all(
  pactLinks.map(async (url) => {
    console.log(`Fetching pact ${url}`);
    return got({
      method: "GET",
      headers: {
        "Accept": "application/hal+json",
        "Authorization": `Bearer ${pactToken}`,
      },
      url,
    }).json();
  })
);

const consumers = pacts.map(pact => {
  return {
    name: pact.consumer.name,
    version: pact._links['pb:consumer-version'].name
  };
});

const tag = `${provider.toLowerCase().split(' ').join('_')}-${releaseBranch}`;
await Promise.all(
  consumers.map(async (consumer) => {
    console.log(`Tagging ${consumer.name} with ${tag}`);
    return got({
      method: "PUT",
      headers: {
        "Accept": "application/hal+json",
        "Authorization": `Bearer ${pactToken}`,
        "Content-Type": "application/json",
      },
      json: {},
      url: `${pactBrokerUrl}/pacticipants/${consumer.name}/versions/${consumer.version}/tags/${tag}`,
    }).json();
  })
);
