export const cameras = [
  { id: 3, label: 'Rampa' }, { id: 1, label: 'Lateral Venezas' },
  { id: 2, label: 'Lixeiras' }, { id: 4, label: 'Portão Serviço' },
  { id: 5, label: 'Calçada' }, { id: 6, label: 'Portão Social' },
  { id: 7, label: 'Entrada Serviço' }, { id: 8, label: 'Portão Garagem' },
  { id: 9, label: 'Elevador Serviço' }, { id: 10, label: 'Hall da Entrada' },
  { id: 11, label: 'Elevador social' }, { id: 12, label: 'Guarita' },
  { id: 13, label: 'Parquinho' }, { id: 14, label: 'Piscina' },
  { id: 15, label: 'Garagem S1' }, { id: 16, label: 'Garagem S2' },
];

export const cameraName = (channel: number) => cameras.find(camera => camera.id === channel)?.label ?? `Canal ${channel}`;
