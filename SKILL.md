---
name: starreview-mcp
description: Use when connecting to or calling the StarReview MCP server (mcp.starpresence.ai) to manage a business's Google and TripAdvisor review replies - covers OAuth connection, the multi-business picker, the double-parsed result envelope, error handling, rate limits, and the approval workflow.
---

# StarReview MCP

StarReview drafts and submits review replies for local businesses. You (the agent) draft and submit; the owner's decision governs publishing. Where a provider has a supported posting API, StarReview's infrastructure performs the post; otherwise the owner posts manually. You can never post a reply yourself - there is no tool for it.

## Connect

Endpoint: `POST https://mcp.starpresence.ai/` (streamable HTTP, stateless; `GET`/`DELETE` return 405). Always send `Accept: application/json, text/event-stream`.

**OAuth 2.1 is the default.** Discovery is standard RFC 9728: fetch `https://mcp.starpresence.ai/.well-known/oauth-protected-resource`, register via dynamic client registration, run the authorization code flow with PKCE (S256). The business owner signs in and approves on a StarReview consent screen. A credential-less request answers 401 with a `WWW-Authenticate` header naming that metadata URL and the scopes to request. Request `offline_access` in addition to the challenged scopes if you want a refresh token.

This is plain OAuth 2.1 with opaque access tokens - deliberately NOT OpenID Connect. Do not request `openid`, do not expect an `id_token`, `userinfo`, or JWKS.

**API-key path (self-serve):** the owner can create an account-wide agent key in their StarReview settings and give it to you (commonly as the `STARREVIEW_API_KEY` environment variable). Send it as `Authorization: Bearer sragt_...`. It identifies the OWNER, so the multi-business picker below applies exactly as in OAuth mode.

Legacy path: an admin-issued per-business bearer token (also `sragt_...`). If you hold one of these, the token pins the business and none of the multi-business handling below applies.

## The toolset depends on your credential

The 178 authenticated tools live at the main endpoint and require a credential: call it without one and you get a 401 challenge, not a tool list. The one free discovery tool (`get_service_info`) lives at `POST https://mcp.starpresence.ai/public`, which needs no credential at all. The two sets are disjoint.

<!-- BEGIN GENERATED agent-surfaces:tool-list — do not hand-edit; run npm run write:agent-surfaces -->
The 234 authenticated tools, projected from the canonical operations registry: `list_locations`, `list_unanswered_reviews`, `generate_replies_for_location`, `draft_reply`, `analyze_review_sentiment`, `refetch_review_text`, `approve_replacement_reply`, `retry_replacement_draft`, `keep_existing_reply`, `list_reply_revisions`, `submit_reply_for_approval`, `save_reply_draft`, `revert_reply_draft`, `mark_review_not_answer`, `restore_review_answer`, `mark_review_removed_from_google`, `set_reply_earliest_publish_time`, `cancel_scheduled_reply`, `delete_published_reply`, `reuse_removed_reply`, `approve_replies_bulk`, `publish_reply_now`, `get_review_context`, `submit_own_reply`, `list_comments`, `list_comment_threads`, `get_comment_thread`, `get_comment_reply_guard`, `assign_comment_location`, `edit_comment_reply`, `draft_comment_reply`, `approve_comment_reply`, `decline_comment`, `resolve_comment_outcome`, `hide_comment_reply`, `unhide_comment_reply`, `mute_comment_author`, `list_comment_opt_outs`, `opt_out_comment_author`, `remove_comment_opt_out`, `add_publish_source`, `list_publish_targets`, `list_destination_selections`, `create_destination_selection`, `resolve_destination_selection`, `update_destination_selection`, `delete_destination_selection`, `compose_publication`, `draft_post_text`, `refine_post_text`, `get_publication`, `get_publication_calendar`, `get_calendar_timeline`, `list_publications`, `download_publication_permalinks`, `cancel_publication`, `delete_published_item`, `edit_published_item`, `release_held_publication`, `move_post`, `create_recurrence_series`, `list_recurrence_series`, `get_recurrence_series`, `edit_recurrence_occurrence`, `split_recurrence_series`, `cancel_recurrence_series`, `list_pending_publications`, `approve_publication`, `save_publication_draft`, `list_publication_drafts`, `delete_publication_draft`, `list_publish_sources`, `get_publish_source`, `update_publish_source`, `pause_publish_source`, `resume_publish_source`, `delete_publish_source`, `list_publish_source_items`, `get_media_constraints`, `upload_media_asset`, `generate_media_image`, `quote_media_generation`, `generate_media_images_per_destination`, `list_media_assets`, `get_media_asset`, `update_media_asset_text`, `withdraw_media_asset`, `derive_media_asset`, `purge_media_asset`, `get_report_stats`, `get_report_analytics`, `get_report_brief`, `get_report_history`, `get_analysen`, `start_ranking_opportunities_run`, `get_ranking_opportunities`, `draft_ranking_opportunity_post`, `list_notifications`, `mark_all_notifications_read`, `mark_notification_read`, `submit_support_contact`, `create_support_request`, `list_support_requests`, `get_support_request`, `mark_support_request_read`, `reply_to_support_request`, `list_agent_keys`, `create_agent_key`, `revoke_agent_key`, `grant_agent_key_scope`, `withdraw_agent_key_scope`, `list_agent_actions`, `get_agent_consent`, `accept_agent_consent`, `list_organization_destination_mounts`, `list_channel_profiles`, `get_channel_summary`, `list_third_party_data_requests`, `erase_third_party_person`, `get_organization_entitlements`, `create_brand`, `list_connection_descriptors`, `get_brand_kit`, `update_brand_kit`, `link_presence_to_brand`, `get_brand_facts`, `update_brand_facts`, `get_brand_reply_style`, `update_brand_reply_style`, `get_channel_reply_style`, `update_channel_reply_style`, `discover_channel_candidates`, `connect_channel_candidate`, `create_presences_for_channels`, `attribute_channel_parent`, `preview_channel_activation`, `set_channel_activation`, `reconnect_channel_profile`, `disconnect_channel_profile`, `resolve_reply_facts`, `list_reply_fact_holds`, `get_google_health`, `list_gbp_categories`, `accept_business_invitation`, `list_team`, `invite_team_member`, `accept_team_invitation`, `revoke_team_invitation`, `change_team_member_role`, `remove_team_member`, `list_businesses`, `create_business`, `toggle_business_status`, `upload_business_avatar`, `delete_business_avatar`, `set_correspondence_email`, `dismiss_autopilot_prompt`, `dismiss_content_policy_proposal`, `create_content_policy_activation_token`, `activate_content_policy`, `update_business`, `update_business_location`, `list_business_members`, `remove_business_member`, `invite_business_member`, `sync_reviews`, `refresh_business_knowledge`, `confirm_business_setup`, `list_voice_examples`, `set_knowledge_notes_consent`, `dismiss_knowledge_fact`, `list_knowledge_confirmations`, `act_on_knowledge_confirmation`, `get_provider_publish_settings`, `update_provider_publish_settings`, `set_provider_publish_consent`, `get_presence_reply_style`, `update_presence_reply_style`, `get_presence_business_type`, `update_presence_business_type`, `get_recap_settings`, `update_recap_settings`, `get_account_profile`, `upload_account_avatar`, `delete_account_avatar`, `delete_account`, `set_acquisition_source`, `get_onboarding_status`, `complete_onboarding`, `get_account_billing_settings`, `update_account_billing_settings`, `get_business_billing_settings`, `update_business_billing_settings`, `assign_business_billing_profile`, `update_holding_billing_profile`, `list_connected_agents`, `revoke_connected_agent`, `get_products_billing_overview`, `generate_social_replies`, `get_social_reply_status`, `buy_social_reply_boost`, `get_social_auto_recharge`, `setup_social_auto_recharge`, `update_social_auto_recharge`, `list_social_platform_profiles`, `create_social_platform_profile`, `update_social_platform_profile`, `delete_social_platform_profile`, `list_social_reply_history`, `mark_social_reply_copied`, `delete_social_reply_history_item`, `start_x_connect`, `start_facebook_connect`, `start_threads_connect`, `start_tiktok_connect`, `get_x_connection_status`, `disconnect_x`, `delete_x_provider_data`, `create_x_import_estimate`, `start_x_import`, `get_x_import_job`, `list_provider_links`, `suggest_tripadvisor_listing`, `get_thefork_connection_status`, `unlink_thefork`, `get_meta_connection_status`, `disconnect_meta_channel`, `get_meta_connect_selection`, `get_meta_data_deletion_status`, `get_threads_data_deletion_status`, `get_farcaster_connection_status`, `unlink_farcaster`, `get_nostr_connection_status`, `unlink_nostr`.

Held for agent callers (registry `hold`): `delete_account` currently refuse with `account_deletion_requires_human`; `approve_comment_reply`, `approve_publication`, `approve_replacement_reply`, `approve_replies_bulk`, `delete_published_item`, `delete_published_reply`, `edit_published_item`, `hide_comment_reply`, `mute_comment_author`, `publish_reply_now`, `release_held_publication`, `unhide_comment_reply` currently refuse with `agent_publishing_not_consented`; `create_agent_key`, `grant_agent_key_scope`, `revoke_agent_key`, `revoke_connected_agent`, `withdraw_agent_key_scope` currently refuse with `authority_change_requires_human`; `assign_business_billing_profile`, `update_account_billing_settings`, `update_business_billing_settings`, `update_holding_billing_profile` currently refuse with `billing_change_requires_human`; `accept_agent_consent`, `set_knowledge_notes_consent` currently refuse with `consent_requires_human`; `delete_x_provider_data`, `erase_third_party_person`, `purge_media_asset` currently refuse with `irreversible_erasure_requires_human`; `accept_business_invitation`, `accept_team_invitation`, `change_team_member_role`, `invite_business_member`, `invite_team_member`, `remove_business_member`, `remove_team_member`, `revoke_team_invitation` currently refuse with `membership_change_requires_human` (membership changes are human-only); `remove_comment_opt_out` currently refuse with `opt_out_removal_requires_human`; `resolve_comment_outcome` currently refuse with `provider_outcome_attestation_requires_the_owner`; `activate_content_policy`, `create_content_policy_activation_token`, `set_provider_publish_consent` currently refuse with `standing_authority_requires_human`.
<!-- END GENERATED agent-surfaces:tool-list -->

`compose_publication` writes package rows only and is not held. `generate_media_image` spends the image pool. `draft_post_text` and `refine_post_text` remain the Copilot names; they never post. The account tools (`get_recap_settings` through `get_products_billing_overview` in the enumeration) are self-scoped: they read or change the calling key owner's own account, never another user's. `generate_social_replies` spends the social-reply pool, and all thirteen social-comment tools answer `feature_disabled` while the deployment's social-reply generator flag is off — the same answer the human surface gives. The provider connection-management tools (`get_x_connection_status` through `unlink_nostr` in the enumeration) read or sever the owner's own provider links: the status reads never return tokens or key material, the unlinks keep ingested history, and `delete_x_provider_data` is the one destructive entry (it erases the imported X content). `start_x_import` consumes exactly the estimate `create_x_import_estimate` priced, so an import can never outrun its quote. Connecting a provider is not here on purpose: OAuth consent and key pastes stay human acts.

## Result envelope: parse twice

Every result, success or error, is JSON serialized inside a text content block:

```json
{ "content": [{ "type": "text", "text": "{\"...\":\"...\"}" }] }
```

Parse the outer MCP result, then `JSON.parse` the text block. Errors carry `"isError": true` and the inner JSON is `{ "code": "..." }`.

## The multi-business picker (owner-wide credentials)

An OAuth session or self-service account-wide `sragt_` key identifies an OWNER, who may manage several businesses. Call `list_locations` or `list_unanswered_reviews` without `businessId` and, if the owner has more than one business, you get a SUCCESS result (not an error) whose payload is:

```json
{ "businesses": [{ "businessId": "...", "name": "..." }], "hint": "You manage multiple businesses. Call again with businessId set to one of these." }
```

Check for this shape (`businesses` + `hint`) before treating any response as the answer. Re-call with `businessId` set. Tools keyed on a `reviewId` (`get_review_context`, `draft_reply`, `submit_reply_for_approval`, `submit_own_reply`) never return a picker - the review determines the business.

## Platforms are open-ended

Every review carries a `provider` field (`google`, `tripadvisor`, ...). The value set GROWS as StarReview activates more platforms - never hardcode it, never reject an unknown value. What differs per platform is the publishing lane: a live posting API may return `autoScheduled`, while a provider without a posting API remains in the approval queue until a human approves it and the owner receives the manual-post link. Trust the response fields, never infer an outcome from the platform name. `list_unanswered_reviews` accepts an optional `provider` filter; an unknown slug returns an empty list.

## Workflow

0. Optional `get_report_stats` for the weekly recap headline stats and flagged low-star pending reviews (GET `/api/report/stats`). Use it to report "how are my reviews doing" — it never changes anything. `get_review_stats` is retired: its body was not that route.
1. `list_unanswered_reviews` (optionally per `locationId`, `provider`, `limit` max 50). Each review carries its `provider`.
2. `get_review_context` for the full text, language, and any existing draft variants.
3. Either `draft_reply` (StarReview generates variants in the business's voice, saved as drafts) then `submit_reply_for_approval` with the chosen `variant` (optionally `finalText` to edit it), OR `submit_own_reply` with your own `finalText` (no StarReview draft; ALWAYS requires human approval, never auto-schedules).
4. Optional `preferredPostAt` (ISO 8601): StarReview will not post before that time.
5. Optional `add_publish_source` (`kind`, `url`, `destination_selection_id`, optional `instruction`/`language`/`name`) adds a Quelle in `review` mode. Never send `mode: unattended` — that is refused with `unattended_requires_human`.
6. Optional `draft_post_text` (`channelProfileId`, `brief`, optional `language`) asks StarReview to draft original post text in the attributed Presence or Brand voice. Optional `refine_post_text` (`channelProfileId`, `draftId`, `text`, `operation`, optional `parameter`/`language`) revises that draft. Both return a draft to hand to a human. Nothing is posted and nothing is approved.
7. Read the submit response:
   - `submit_reply_for_approval` returns `{ submitted, autoScheduled, gateOutcomes }` - `gateOutcomes` explains whether the reply scheduled on the owner's standing consent or waits in the approval queue.
   - `submit_own_reply` returns `{ submitted: true, autoScheduled: false }`; your own text always waits for a human.
   - A provider without a posting API does not auto-schedule from an agent submission. It remains pending until human approval; only then does the owner receive the manual-post outcome below.
   - `gateOutcomes.agentConsentCurrent` reports whether the owner accepted the current Agent Access policy. When false, submission still succeeds but remains pending with `pendingReason: "agent_consent_upgrade_required"`.

**TripAdvisor terminal state:** there is no TripAdvisor reply API. Agent submission stays pending until a human approves it. The approved reply then has `awaitingManualPost: true` plus a `platformListingUrl` deep link - the OWNER posts it through TripAdvisor's own portal. Treat that eventual state as distinct from an API post; do not claim it was posted.

## Error codes: refusals vs failures

Refusals (audited as denied; do NOT blind-retry - each needs a different response):

| code | meaning | what to do |
|---|---|---|
| `forbidden` | not your business, or access revoked | stop; re-check scope |
| `posting_paywall` | business has no active subscription | tell the owner to subscribe |
| `review_not_pending` | review already handled | refresh your list |
| `free_quota_exhausted` | free reply allowance used up | tell the owner to subscribe |
| `not_editable` | reply past its editable state | stop |
| `already_processed` | duplicate submission | treat as success |
| `business_not_connected` | owner has no connected business | send them to onboarding |
| `fact_resolution_required` | the reply needs an exact Geschäft selection before its facts are safe to use | ask the owner to resolve the held item in StarReview; retry only after resolution |
| `unattended_requires_human` | `add_publish_source` cannot opt a Quelle into unbeaufsichtigt | tell the owner to switch the source in StarReview; do not retry with `mode: unattended` |
| `attribution_required` | the channel has no Presence or Brand parent, so Copilot will not guess a voice | tell the owner to attribute the channel in StarReview; retry only after attribution |
| `subscription_required` | the Organization has no active subscription or trial | stop and tell the human; never retry |
| `agent_publishing_not_consented` | a registered posting-shaped tool refused under the published Agent MCP Privacy document | stop; do not retry; the owner posts through StarReview |
| `membership_change_requires_human` | inviting or removing a business member is human-only | stop; do not retry; the owner changes membership in StarReview |
| `origin_not_allowed` | this origin cannot run the operation | stop; do not retry as an agent |
| `operation_not_registered` | no canonical binding for this path or tool | stop; fix the tool or path |

Failures and limits:

| code | meaning | what to do |
|---|---|---|
| `unknown_tool` | no such tool | fix the tool name |
| `invalid_arguments` | schema validation failed (never burns quota) | fix the arguments |
| `not_found` | referenced entity does not exist | re-fetch context |
| `surface_retired` | tool was published and has since been retired (`search_business`, `check_response_rate`) — do not call it again | do not call it again |
| `variant_not_found` | variant number does not exist for this review | re-run `draft_reply` |
| `rate_limited_per_minute` | per-minute cap hit | back off ≥60s |
| `daily_cap_exceeded` / `daily_draft_cap_exceeded` | daily cap hit | stop for the day |
| `db_error` / `audit_unavailable` / `internal_error` | transient server fault (audit fails closed) | retry with backoff |
| `photo_negative_manual_review` | photo reply on a negative review needs manual handling | leave for the owner |

## Rate limits

Authenticated: 20 tool calls/min per credential; `draft_reply` ~25/day. Public: the binding limit is **10 tool calls/min per IP** (a separate 30 req/min HTTP burst shield sits outside these - do not pace against it). Invalid arguments are rejected before any quota is claimed.

## Boundaries (state them accurately)

- An agent cannot publish to any provider: structural - there is no posting tool. `add_publish_source` creates a Quelle; it never posts and cannot opt the source into unbeaufsichtigt. `draft_post_text` and `refine_post_text` return draft text only; they never post and never approve.
- StarReview applies the owner's existing approval and provider-specific automatic-publishing settings. On a live posting API, an eligible, unedited StarReview draft may schedule without another click when current Agent Consent and safety checks allow it.
- Agent-written, edited, or safety-held replies remain pending. `submit_own_reply` never takes the automatic path.
- A provider without a posting API remains pending until human approval; the owner then posts manually through the returned link.

## Compatibility promise

Contract changes are additive-only: new tools, new optional arguments, new response fields, and new `provider` values may appear in any minor version; existing tools are never removed and existing fields never change meaning without a MAJOR version bump. An agent written against this document keeps working.
