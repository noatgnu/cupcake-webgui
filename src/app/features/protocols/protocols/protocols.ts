import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ProtocolsNavbar } from '../protocols-navbar/protocols-navbar';

@Component({
  selector: 'app-protocols',
  imports: [ProtocolsNavbar, RouterOutlet],
  templateUrl: './protocols.html',
  styleUrl: './protocols.scss'
})
export class Protocols {

}
