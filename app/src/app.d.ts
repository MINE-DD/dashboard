import type { DefaultSession } from '@auth/core/types';

declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface Platform {}
	}
}

interface CustomUser extends DefaultSession['user'] {
	id: string;
	name: string;
	roles: string[];
}

export interface CustomSession extends DefaultSession {
	user: CustomUser;
}

export { };
