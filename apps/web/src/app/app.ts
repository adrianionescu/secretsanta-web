import { Component, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SessionFormComponent } from './components/session-form/session-form.component';
import { SessionListComponent } from './components/session-list/session-list.component';
import { LoginComponent } from './components/login/login.component';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, SessionFormComponent, SessionListComponent, LoginComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
})
export class AppComponent {
  readonly authService = inject(AuthService);

  @ViewChild(SessionListComponent) sessionList!: SessionListComponent;

  onSessionSaved() {
    if (this.sessionList) {
      this.sessionList.load();
    }
  }
}
