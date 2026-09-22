import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  /** Anon-key client: use for user-initiated auth actions (sign up, sign in). */
  readonly client: SupabaseClient;

  /** Service-role client: use for server-side/admin operations (token validation, storage). */
  readonly adminClient: SupabaseClient;

  constructor(configService: ConfigService) {
    const url = configService.getOrThrow<string>('SUPABASE_URL');

    this.client = createClient(
      url,
      configService.getOrThrow<string>('SUPABASE_ANON_KEY'),
    );
    this.adminClient = createClient(
      url,
      configService.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
    );
  }
}
