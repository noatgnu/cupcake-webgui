import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, ActivatedRoute } from '@angular/router';
import { HomeNavbar } from '../home-navbar/home-navbar';
import { TasksView } from '../tasks-view/tasks-view';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-home',
  imports: [CommonModule, HomeNavbar, RouterOutlet, TasksView],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class Home implements OnInit, OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private fragmentSubscription?: Subscription;

  activeSection: 'dashboard' | 'projects' | 'lab-groups' | 'users' | 'messages' | 'notifications' | 'profile' | 'site-config' | 'tasks' = 'dashboard';

  ngOnInit(): void {
    this.updateActiveSection();

    this.fragmentSubscription = this.route.fragment.subscribe(fragment => {
      if (fragment === 'tasks') {
        this.activeSection = 'tasks';
      }
    });
  }

  ngOnDestroy(): void {
    if (this.fragmentSubscription) {
      this.fragmentSubscription.unsubscribe();
    }
  }

  private updateActiveSection(): void {
    const urlSegments = this.router.url.split('/');
    const lastSegment = urlSegments[urlSegments.length - 1].split('#')[0];
    const fragment = this.route.snapshot.fragment;

    if (fragment === 'tasks') {
      this.activeSection = 'tasks';
    } else if (lastSegment === 'projects' || lastSegment === 'lab-groups' || lastSegment === 'users' || lastSegment === 'messages' || lastSegment === 'notifications' || lastSegment === 'profile' || lastSegment === 'site-config' || lastSegment === 'tasks') {
      this.activeSection = lastSegment as typeof this.activeSection;
    } else {
      this.activeSection = 'dashboard';
    }
  }

  showSection(section: 'dashboard' | 'projects' | 'lab-groups' | 'users' | 'messages' | 'notifications' | 'profile' | 'site-config' | 'tasks'): void {
    this.activeSection = section;
    if (section === 'dashboard') {
      this.router.navigate(['/home']);
    } else if (section === 'tasks') {
      this.router.navigate(['/home'], { fragment: 'tasks' });
    } else {
      this.router.navigate(['/home', section]);
    }
  }
}
