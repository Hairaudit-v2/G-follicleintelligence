-- WorkforceOS: add maternity_leave availability block type for HR leave workflows.

alter table public.fi_staff_availability_blocks
  drop constraint if exists fi_staff_availability_blocks_block_type;

alter table public.fi_staff_availability_blocks
  add constraint fi_staff_availability_blocks_block_type check (
    block_type in (
      'unavailable',
      'leave',
      'sick_leave',
      'maternity_leave',
      'training',
      'admin',
      'available_override'
    )
  );
