import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const ADMIN = 'admin-id';
const STAFF = 'staff-id';
const NEWBIE = 'newbie-id';

const insert = vi.fn(async () => ({ error: null }));
const update = vi.fn(() => ({ eq: async () => ({ error: null }) }));

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: ADMIN } }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'user_roles') {
        return {
          select: async () => ({
            data: [
              { id: 'r1', user_id: ADMIN, role: 'admin' },
              { id: 'r2', user_id: STAFF, role: 'team' },
            ],
            error: null,
          }),
          insert,
          update,
          delete: () => ({ in: async () => ({ error: null }) }),
        };
      }
      return {
        select: async () => ({
          data: [
            { user_id: ADMIN, full_name: 'Drew', created_at: '2026-01-01T00:00:00Z' },
            { user_id: STAFF, full_name: 'Sam Staff', created_at: '2026-02-01T00:00:00Z' },
            { user_id: NEWBIE, full_name: 'New Hire', created_at: '2026-11-11T00:00:00Z' },
          ],
          error: null,
        }),
      };
    },
  },
}));

import { AccessSection } from './AccessSection';

// Radix Select needs these pointer/scroll APIs, which jsdom doesn't provide.
beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
  insert.mockClear();
  update.mockClear();
});

function renderSection() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AccessSection />
    </QueryClientProvider>,
  );
}

describe('Logins & Access', () => {
  it('lists people waiting for approval first, next to approved logins', async () => {
    renderSection();
    expect(await screen.findByText('New Hire')).toBeInTheDocument();
    expect(screen.getByText(/1 person is waiting for approval/)).toBeInTheDocument();
    expect(screen.getByText(/Waiting for approval · signed up/)).toBeInTheDocument();
    const names = screen.getAllByText(/^(New Hire|Sam Staff|Drew)$/).map((n) => n.textContent);
    expect(names[0]).toBe('New Hire');
  });

  it('approving a new sign-up creates their first role', async () => {
    renderSection();
    const trigger = await screen.findByRole('combobox', { name: 'Access for New Hire' });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'Enter' });
    fireEvent.click(await screen.findByRole('option', { name: 'Team' }));
    expect(await screen.findByText('Give New Hire Team access?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Give access' }));
    await waitFor(() => expect(insert).toHaveBeenCalledWith({ user_id: NEWBIE, role: 'team' }));
    expect(update).not.toHaveBeenCalled();
  });

  it("still won't let you change your own access", async () => {
    renderSection();
    expect(await screen.findByRole('combobox', { name: 'Access for Drew' })).toBeDisabled();
  });
});
