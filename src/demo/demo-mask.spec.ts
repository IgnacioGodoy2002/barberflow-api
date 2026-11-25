import { maskForDemo } from './demo-mask';

describe('maskForDemo', () => {
  const appointment = {
    id: 'a1',
    notes: 'Llamar al 1122334455',
    price: '9000.00',
    startAt: new Date('2026-12-01T13:00:00Z'),
    client: {
      id: 'f3a2-11',
      fullName: 'Juan Pérez',
      email: 'juan@gmail.com',
      phone: '+54 9 11 2233-4455',
    },
    barber: {
      displayName: 'Nacho',
      user: { id: 'u2', fullName: 'Ignacio Godoy', email: 'nacho@gmail.com' },
    },
  };

  it('oculta nombre, email, teléfono y notas de los clientes', () => {
    const masked = maskForDemo(appointment, 'demo-id');

    expect(masked.client.fullName).toBe('Cliente F3A2');
    expect(masked.client.email).toBe('j•••@•••');
    expect(masked.client.phone).toBe('•••• 55');
    expect(masked.notes).toBe('(nota oculta en el modo demo)');
  });

  it('mantiene los datos públicos y las fechas', () => {
    const masked = maskForDemo(appointment, 'demo-id');

    expect(masked.barber.displayName).toBe('Nacho');
    expect(masked.price).toBe('9000.00');
    expect(masked.startAt).toBeInstanceOf(Date);
  });

  it('funciona con listas y no toca los datos del propio usuario demo', () => {
    const [self, other] = maskForDemo(
      [
        { id: 'demo-id', fullName: 'Visitante', email: 'demo@barberflow.app' },
        { id: 'x', fullName: 'Ana', email: 'ana@mail.com' },
      ],
      'demo-id',
    );

    expect(self.email).toBe('demo@barberflow.app');
    expect(other.fullName).toBe('Cliente X');
  });

  it('no modifica el objeto original', () => {
    maskForDemo(appointment, 'demo-id');
    expect(appointment.client.fullName).toBe('Juan Pérez');
  });
});
