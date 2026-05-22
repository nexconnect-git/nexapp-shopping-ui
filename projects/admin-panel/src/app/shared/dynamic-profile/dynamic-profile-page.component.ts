import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { DisplayValuePipe } from './display-value.pipe';
import {
  DynamicProfileConfig,
  ProfileHeroAction,
} from './dynamic-profile.models';

@Component({
  selector: 'nc-dynamic-profile-page',
  standalone: true,
  imports: [NgFor, NgIf, DisplayValuePipe],
  templateUrl: './dynamic-profile-page.component.html',
  styleUrls: ['./dynamic-profile-page.component.scss'],
})
export class DynamicProfilePageComponent {
  @Input({ required: true }) config!: DynamicProfileConfig;
  @Output() action = new EventEmitter<ProfileHeroAction>();
  @Output() editSection = new EventEmitter<string>();

  trackById(
    _: number,
    item: { id?: string; label?: string; title?: string },
  ): string {
    return String(item.id ?? item.label ?? item.title);
  }
}
