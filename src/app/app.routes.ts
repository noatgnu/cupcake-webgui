import { Routes } from '@angular/router';
import { LoginComponent, RegisterComponent, authGuard } from '@noatgnu/cupcake-core';
import { AppShell } from './core/layout/app-shell/app-shell';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent
  },
  {
    path: 'register',
    component: RegisterComponent
  },
  {
    path: '',
    component: AppShell,
    canActivate: [authGuard],
    children: [
      {
        path: 'home',
        loadComponent: () => import('./features/home/home/home').then(m => m.Home),
        children: [
          {
            path: 'projects',
            loadComponent: () => import('./features/home/projects/projects').then(m => m.Projects)
          },
          {
            path: 'lab-groups',
            loadComponent: () => import('./features/lab-groups/lab-group-list/lab-group-list').then(m => m.LabGroupList)
          },
          {
            path: 'users',
            loadComponent: () => import('./features/users/user-list/user-list').then(m => m.UserList)
          },
          {
            path: 'profile',
            loadComponent: () => import('./features/home/user-profile/user-profile').then(m => m.UserProfile)
          },
          {
            path: 'notifications',
            loadComponent: () => import('./features/home/notifications-view/notifications-view').then(m => m.NotificationsView)
          },
          {
            path: 'messages',
            loadComponent: () => import('./features/home/messages-view/messages-view').then(m => m.MessagesView)
          },
          {
            path: 'messages/:id',
            loadComponent: () => import('./features/home/messages-view/messages-view').then(m => m.MessagesView)
          },
          {
            path: 'site-config',
            loadComponent: () => import('./features/admin/site-config/site-config').then(m => m.SiteConfig)
          },
          {
            path: '',
            pathMatch: 'full',
            redirectTo: 'dashboard'
          }
        ]
      },
      {
        path: 'protocols',
        loadComponent: () => import('./features/protocols/protocols/protocols').then(m => m.Protocols),
        children: [
          {
            path: '',
            loadComponent: () => import('./features/protocols/protocol-list/protocol-list').then(m => m.ProtocolList)
          },
          {
            path: 'sessions',
            loadComponent: () => import('./features/protocols/session-list/session-list').then(m => m.SessionList)
          },
          {
            path: 'sessions/:id',
            loadComponent: () => import('./features/protocols/session-detail/session-detail').then(m => m.SessionDetail)
          },
          {
            path: 'timers',
            loadComponent: () => import('./features/protocols/timekeeper-standalone/timekeeper-standalone').then(m => m.TimekeeperStandalone)
          },
          {
            path: ':id/edit',
            loadComponent: () => import('./features/protocols/protocol-editor/protocol-editor').then(m => m.ProtocolEditor)
          }
        ]
      },
      {
        path: 'instruments',
        loadComponent: () => import('./features/instruments/instruments/instruments').then(m => m.Instruments)
      },
      {
        path: 'instruments/:id',
        loadComponent: () => import('./features/instruments/instruments/instruments').then(m => m.Instruments)
      },
      {
        path: 'storage',
        loadComponent: () => import('./features/storage/storage/storage').then(m => m.Storage)
      },
      {
        path: 'storage/:id',
        loadComponent: () => import('./features/storage/storage/storage').then(m => m.Storage)
      },
      {
        path: 'jobs',
        loadComponent: () => import('./features/jobs/jobs/jobs').then(m => m.Jobs),
        children: [
          {
            path: '',
            loadComponent: () => import('./features/jobs/job-list/job-list').then(m => m.JobList)
          },
          {
            path: 'submit',
            loadComponent: () => import('./features/jobs/job-submission/job-submission').then(m => m.JobSubmission)
          },
          {
            path: 'templates',
            loadComponent: () => import('@noatgnu/cupcake-vanilla').then(m => m.MetadataTableTemplates)
          },
          {
            path: 'column-templates',
            loadComponent: () => import('@noatgnu/cupcake-vanilla').then(m => m.ColumnTemplates)
          },
          {
            path: 'favorites',
            loadComponent: () => import('@noatgnu/cupcake-vanilla').then(m => m.FavoriteManagement)
          },
          {
            path: ':id',
            loadComponent: () => import('./features/jobs/job-detail/job-detail').then(m => m.JobDetail)
          }
        ]
      },
      {
        path: '',
        redirectTo: '/home',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];
