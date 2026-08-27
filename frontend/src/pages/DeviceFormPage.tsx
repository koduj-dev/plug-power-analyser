import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createDevice, deleteDevice, getDevice, updateDevice } from '../api/client';
import { DeviceForm } from '../components/DeviceForm';
import type { DeviceDto, DeviceFormInput } from '../types';

export function DeviceFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = id !== undefined && id !== 'new';
  const [device, setDevice] = useState<DeviceDto | null>(null);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    getDevice(Number(id))
      .then((d) => !cancelled && setDevice(d))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id, isEdit]);

  async function handleSubmit(input: Partial<DeviceFormInput>) {
    if (isEdit && id) {
      await updateDevice(Number(id), input);
    } else {
      await createDevice(input);
    }
    navigate('/');
  }

  async function handleDelete() {
    if (!id || !isEdit) return;
    if (!window.confirm(`Delete device "${device?.name}"? This also deletes its stored telemetry.`)) return;
    await deleteDevice(Number(id));
    navigate('/');
  }

  if (loading) return <p>Loading…</p>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>{isEdit ? `Edit ${device?.name ?? 'device'}` : 'Add device'}</h1>
        <Link to="/">← Back</Link>
      </div>
      <DeviceForm initial={device ?? undefined} submitLabel={isEdit ? 'Save changes' : 'Add device'} onSubmit={handleSubmit} />
      {isEdit && (
        <button type="button" className="button-danger" onClick={handleDelete}>
          Delete device
        </button>
      )}
    </div>
  );
}
