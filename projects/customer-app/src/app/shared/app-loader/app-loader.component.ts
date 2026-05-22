import { Component } from '@angular/core';
import { AppLoaderService } from './app-loader.service';

@Component({
  selector: 'fd-app-loader',
  standalone: true,
  templateUrl: './app-loader.component.html',
  styleUrls: ['./app-loader.component.scss'],
})
export class AppLoaderComponent {
  constructor(public loader: AppLoaderService) {}
}
