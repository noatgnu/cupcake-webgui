export const environment = {
  production: true,
  apiUrl: '/api/v1',
  websocketUrl: `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`,
  features: {
    asyncTasks: true
  },
  isWails: false
};
