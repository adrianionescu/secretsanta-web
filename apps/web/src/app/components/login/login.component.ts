import { Component, OnInit, ElementRef, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent implements OnInit {
  private readonly authService = inject(AuthService);

  @ViewChild('googleBtn', { static: true }) googleBtn!: ElementRef<HTMLDivElement>;

  error = '';
  loading = false;

  ngOnInit(): void {
    this.authService.initGoogleSignIn(async (idToken) => {
      this.loading = true;
      this.error = '';
      try {
        await this.authService.signInWithGoogle(idToken);
      } catch {
        this.error = 'Access denied. Your account is not on the allowed list.';
      } finally {
        this.loading = false;
      }
    });
    this.authService.renderGoogleButton(this.googleBtn.nativeElement);
  }
}
