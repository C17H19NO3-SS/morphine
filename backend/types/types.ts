export interface UserInterface {
  id?: number;
  username: string;
  email: string;
  password?: string;
}

export interface UserTokenInterface {
  token: string;
}

export interface Manifest {
  version: string;
  name: string;
  author: string;
  index: string;
}
