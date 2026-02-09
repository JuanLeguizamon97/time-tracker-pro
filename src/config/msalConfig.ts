import { PublicClientApplication, Configuration } from '@azure/msal-browser';

const msalConfig: Configuration = {
  auth: {
    clientId: 'b44bcf9e-cc38-4542-82b9-e9447a45a7ec',
    authority: 'https://login.microsoftonline.com/9a347a67-e3c3-4de7-9c88-449af6f6c092',
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
};

export const msalInstance = new PublicClientApplication(msalConfig);

export const loginRequest = {
  scopes: ['api://6cda0fcc-09b3-4173-b6cc-07df8bf2b82b/user_impersonation'],
};
