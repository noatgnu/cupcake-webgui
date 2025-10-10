import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, ActivatedRoute } from '@angular/router';
import { HomeNavbar } from '../home-navbar/home-navbar';

@Component({
  selector: 'app-home',
  imports: [CommonModule, HomeNavbar, RouterOutlet],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class Home implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  activeSection: 'dashboard' | 'projects' | 'lab-groups' | 'users' | 'messages' | 'notifications' | 'profile' | 'site-config' = 'dashboard';

  ngOnInit(): void {
    const urlSegments = this.router.url.split('/');
    const lastSegment = urlSegments[urlSegments.length - 1];
    if (lastSegment === 'projects' || lastSegment === 'lab-groups' || lastSegment === 'users' || lastSegment === 'messages' || lastSegment === 'notifications' || lastSegment === 'profile' || lastSegment === 'site-config') {
      this.activeSection = lastSegment;
    } else {
      this.activeSection = 'dashboard';
    }
  }

  showSection(section: 'dashboard' | 'projects' | 'lab-groups' | 'users' | 'messages' | 'notifications' | 'profile' | 'site-config'): void {
    this.activeSection = section;
    if (section === 'dashboard') {
      this.router.navigate(['/home']);
    } else {
      this.router.navigate(['/home', section]);
    }
  }
}
