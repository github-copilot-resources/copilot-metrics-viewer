//https://github.com/atinux/nuxt-auth-utils?tab=readme-ov-file#session-management

declare module '#auth-utils' {
    interface User {
        name: string;
        avatarUrl: string;
        githubId: number;
    }

    // interface UserSession {
    //   }

    interface SecureSessionData {
        tokens: {
            access_token: string;
            expires_in: number;
            refresh_token: string;
            refresh_token_expires_in: number;
        };
        expires_at: Date;
    }
}

export { }
