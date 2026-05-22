import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { installEmojiIconSystem } from '@shared/public-api';

installEmojiIconSystem();
bootstrapApplication(AppComponent, appConfig).catch((err) =>
  console.error(err),
);
