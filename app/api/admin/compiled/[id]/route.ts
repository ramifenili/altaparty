import {NextResponse} from 'next/server';
import {requireAdmin} from '../../../../../src/server/admin';
import {getStore} from '../../../../../src/server/store';

export const runtime = 'nodejs';

export async function DELETE(req: Request, ctx: {params: Promise<{id: string}>}) {
	const denied = requireAdmin(req, {mutating: true});
	if (denied) return denied;
	const {id} = await ctx.params;
	if (!/^c-[a-z0-9-]{2,36}$/.test(id)) return NextResponse.json({error: 'invalid'}, {status: 400});
	return NextResponse.json({deleted: await getStore().deleteCompiled(id)});
}
