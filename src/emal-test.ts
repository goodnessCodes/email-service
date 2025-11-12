import { Redis } from "@upstash/redis";

const redis = new Redis({
    url: 'https://coherent-gibbon-35338.upstash.io',
    token: 'AYoKAAIncDIxZmI1ZDBlYjgyYzY0ZmViOTUyNTI4MTNkYmU2OTJjM3AyMzUzMzg',
});

async function test() {
    try {
        await redis.set('test', 'working');
        const result = await redis.get('test');
        console.log('✅ Redis connection successful:', result);
    } catch (error) {
        console.log('❌ Redis connection failed:', error.message);
    }
}

test();