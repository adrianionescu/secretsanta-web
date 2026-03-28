import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

declare const google: {
  accounts: {
    id: {
      initialize: (config: object) => void;
      prompt: () => void;
      renderButton: (element: HTMLElement, config: object) => void;
    };
  };
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly tokenKey = 'auth_token';
  private readonly authState = new BehaviorSubject<boolean>(this.hasToken());

  readonly isAuthenticated$ = this.authState.asObservable();

  private hasToken(): boolean {
    return !!sessionStorage.getItem(this.tokenKey);
  }

  getToken(): string | null {
    return sessionStorage.getItem(this.tokenKey);
  }

  async signInWithGoogle(idToken: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<{ accessToken: string }>(
        `${environment.backendUrl}/auth/google`,
        { idToken }
      )
    );
    sessionStorage.setItem(this.tokenKey, res.accessToken);
    this.authState.next(true);
  }

  signOut(): void {
    sessionStorage.removeItem(this.tokenKey);
    this.authState.next(false);
  }

  initGoogleSignIn(callback: (idToken: string) => void): void {
    google.accounts.id.initialize({
      client_id: environment.googleClientId,
      callback: (response: { credential: string }) => callback(response.credential),
    });
  }

  renderGoogleButton(element: HTMLElement): void {
    google.accounts.id.renderButton(element, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
    });
  }
}
