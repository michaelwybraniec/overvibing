module.exports = (env) =>
{
    if(env.production)
    {
        return require('./bundler/webpack.prod.js')
    }

    return require('./bundler/webpack.dev.js')
} 